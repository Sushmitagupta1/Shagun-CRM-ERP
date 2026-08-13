from datetime import date, datetime, time, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus, FollowUp, Meeting
from app.models.menu_slot import MenuSlot
from app.models.user import User
from app.models.warehouse_request import WarehouseRequest


async def get_admin_kpis(db: AsyncSession) -> dict:
    today = date.today()
    total = (await db.execute(select(func.count(Inquiry.id)))).scalar() or 0
    advance_received = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.ADVANCE_RECEIVE))).scalar() or 0
    handover = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.OPERATION_HANDOVER))).scalar() or 0
    total_confirmed = advance_received + handover
    upcoming = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.event_date >= today, Inquiry.status.in_([InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER])))).scalar() or 0
    today_events = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.event_date == today, Inquiry.status.in_([InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER])))).scalar() or 0
    pending_payment = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status.in_([InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER]), Inquiry.payment_status != PaymentStatus.PAID))).scalar() or 0
    total_revenue = (await db.execute(select(func.coalesce(func.sum(Inquiry.advance_amount), 0)))).scalar() or 0
    outstanding = (await db.execute(select(func.coalesce(func.sum(Inquiry.per_plate_rate - Inquiry.advance_amount), 0)).where(Inquiry.status.in_([InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER]), Inquiry.payment_status != PaymentStatus.PAID))).scalar() or 0

    confirmed_statuses = [InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER]
    payment_statuses = [InquiryStatus.CLIENT_CONFIRMATION] + confirmed_statuses
    due_result = await db.execute(
        select(Inquiry)
        .where(Inquiry.status.in_(payment_statuses), Inquiry.payment_status != PaymentStatus.PAID)
        .order_by(Inquiry.event_date.asc())
        .limit(50)
    )
    due_inquiries = due_result.scalars().all()
    payment_approvals = [
        {
            "id": str(i.id),
            "client_name": i.client_name,
            "event_type": i.event_type,
            "event_date": i.event_date.isoformat() if i.event_date else None,
            "status": i.status.value if hasattr(i.status, "value") else i.status,
            "payment_status": i.payment_status.value if hasattr(i.payment_status, "value") else i.payment_status,
            "advance_amount": float(i.advance_amount or 0),
            "total_amount": (float(i.per_plate_rate or 0) * (i.pax or 0)) + float(i.add_on or 0) if i.per_plate_rate is not None else None,
            "remaining_payment_date": i.remaining_payment_date.isoformat() if i.remaining_payment_date else None,
        }
        for i in due_inquiries
    ]

    confirmed_result = await db.execute(
        select(Inquiry).where(Inquiry.status.in_(confirmed_statuses)).order_by(Inquiry.event_date.asc()).limit(100)
    )
    confirmed_inquiries = confirmed_result.scalars().all()
    final_slot_ids: set = set()
    if confirmed_inquiries:
        ids = [i.id for i in confirmed_inquiries]
        slot_result = await db.execute(
            select(MenuSlot.inquiry_id).where(MenuSlot.inquiry_id.in_(ids), MenuSlot.is_final.is_(True))
        )
        final_slot_ids = {row[0] for row in slot_result.all()}
    pending_menu_inquiries = [
        i for i in confirmed_inquiries
        if i.menu_file_name is None and i.id not in final_slot_ids
    ]
    pending_menus_list = [
        {
            "id": str(i.id),
            "client_name": i.client_name,
            "event_type": i.event_type,
            "event_date": i.event_date.isoformat() if i.event_date else None,
            "status": i.status.value if hasattr(i.status, "value") else i.status,
        }
        for i in pending_menu_inquiries
    ]

    return {
        "total_inquiries": total, "confirmed": total_confirmed,
        "cancelled": 0, "upcoming_events": upcoming,
        "today_events": today_events, "pending_payments": pending_payment,
        "pending_menus": len(pending_menu_inquiries),
        "total_revenue": float(total_revenue), "outstanding_amount": float(outstanding),
        "pending_kitchen_plans": 0, "pending_warehouse_requests": 0,
        "payment_approvals": payment_approvals,
        "pending_menus_list": pending_menus_list,
    }


async def get_sales_kpis(db: AsyncSession) -> dict:
    today = date.today()
    new_inquiry = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.NEW_INQUIRY))).scalar() or 0
    upcoming_followups = (await db.execute(
        select(func.count(FollowUp.id)).where(FollowUp.follow_up_date >= today, FollowUp.is_done.is_(False))
    )).scalar() or 0
    overdue = (await db.execute(
        select(func.count(FollowUp.id))
        .join(Inquiry, FollowUp.inquiry_id == Inquiry.id)
        .where(FollowUp.follow_up_date < today, FollowUp.is_done.is_(False), Inquiry.status.in_([InquiryStatus.NEW_INQUIRY, InquiryStatus.FOLLOWUP]))
    )).scalar() or 0
    advance_received = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.ADVANCE_RECEIVE))).scalar() or 0
    handover = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.OPERATION_HANDOVER))).scalar() or 0
    confirmed_count = advance_received + handover
    pending_payment = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status.in_([InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER]), Inquiry.payment_status != PaymentStatus.PAID))).scalar() or 0
    total_sales = (await db.execute(select(func.coalesce(func.sum(Inquiry.per_plate_rate), 0)).where(Inquiry.status.in_([InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER])))).scalar() or 0
    total_count = (await db.execute(select(func.count(Inquiry.id)))).scalar() or 0
    conversion_rate = (confirmed_count / total_count * 100) if total_count > 0 else 0

    next_follow_up = await db.execute(
        select(FollowUp, Inquiry.client_name)
        .join(Inquiry, FollowUp.inquiry_id == Inquiry.id)
        .where(FollowUp.follow_up_date >= today, FollowUp.is_done.is_(False))
        .order_by(FollowUp.follow_up_date.asc())
        .limit(1)
    )
    next_follow_up_row = next_follow_up.first()
    next_follow_up_info = None
    if next_follow_up_row:
        fu, name = next_follow_up_row
        next_follow_up_info = {
            "client_name": name,
            "follow_up_date": fu.follow_up_date.isoformat(),
            "remarks": fu.remarks,
        }

    upcoming_followups_result = (await db.execute(
        select(FollowUp, Inquiry.client_name, Inquiry.event_type)
        .join(Inquiry, FollowUp.inquiry_id == Inquiry.id)
        .where(FollowUp.follow_up_date >= today, FollowUp.is_done.is_(False))
        .order_by(FollowUp.follow_up_date.asc())
        .limit(10)
    )).all()
    upcoming_followups_list = [
        {
            "id": str(fu.id),
            "inquiry_id": str(fu.inquiry_id),
            "client_name": name,
            "event_type": event_type,
            "follow_up_date": fu.follow_up_date.isoformat(),
            "remarks": fu.remarks,
        }
        for fu, name, event_type in upcoming_followups_result
    ]

    confirmed_statuses = [InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER]
    confirmed_result = await db.execute(
        select(Inquiry).where(Inquiry.status.in_(confirmed_statuses)).order_by(Inquiry.event_date.asc()).limit(100)
    )
    confirmed_inquiries = confirmed_result.scalars().all()
    final_slot_ids: set = set()
    if confirmed_inquiries:
        ids = [i.id for i in confirmed_inquiries]
        slot_result = await db.execute(
            select(MenuSlot.inquiry_id).where(MenuSlot.inquiry_id.in_(ids), MenuSlot.is_final.is_(True))
        )
        final_slot_ids = {row[0] for row in slot_result.all()}
    pending_menu_inquiries = [
        i for i in confirmed_inquiries
        if i.menu_file_name is None and i.id not in final_slot_ids
    ]
    pending_menus_list = [
        {
            "id": str(i.id),
            "client_name": i.client_name,
            "event_type": i.event_type,
            "event_date": i.event_date.isoformat() if i.event_date else None,
            "status": i.status.value if hasattr(i.status, "value") else i.status,
        }
        for i in pending_menu_inquiries
    ]

    meetings_result = await db.execute(
        select(Meeting, Inquiry.client_name, Inquiry.event_type, User.full_name)
        .join(Inquiry, Meeting.inquiry_id == Inquiry.id)
        .outerjoin(User, User.id == Meeting.created_by)
        .where(Meeting.meeting_at >= datetime.combine(today, time.min) - timedelta(days=7))
        .order_by(Meeting.meeting_at.asc())
        .limit(10)
    )
    meetings_list = [
        {
            "id": str(m.id),
            "inquiry_id": str(m.inquiry_id),
            "client_name": name,
            "event_type": event_type,
            "meeting_at": m.meeting_at.isoformat(),
            "remarks": m.remarks,
            "status": m.status,
            "created_by_name": creator,
        }
        for m, name, event_type, creator in meetings_result.all()
    ]

    return {
        "total_inquiries": total_count, "new_inquiries": new_inquiry, "upcoming_followups": upcoming_followups,
        "overdue_followups": overdue, "confirmed": confirmed_count,
        "cancelled": 0, "pending_presentations": 0,
        "pending_menus": 0, "pending_payments": pending_payment,
        "total_sales_value": float(total_sales), "conversion_rate": round(conversion_rate, 1),
        "next_follow_up": next_follow_up_info,
        "upcoming_followups_list": upcoming_followups_list,
        "pending_menus_list": pending_menus_list,
        "meetings": meetings_list,
    }


async def get_monthly_trend(db: AsyncSession) -> list:
    result = await db.execute(
        select(func.to_char(Inquiry.created_at, 'YYYY-MM').label('month'), func.count(Inquiry.id).label('count'))
        .group_by('month').order_by('month').limit(12)
    )
    return [{"month": row.month, "count": row.count} for row in result.all()]


async def get_status_distribution(db: AsyncSession) -> list:
    result = await db.execute(select(Inquiry.status, func.count(Inquiry.id).label('count')).group_by(Inquiry.status))
    return [{"status": row.status.value if not isinstance(row.status, str) else row.status, "count": row.count} for row in result.all()]


async def get_sales_funnel(db: AsyncSession) -> list:
    stages = [
        ("New Inquiry", InquiryStatus.NEW_INQUIRY),
        ("Follow Up", InquiryStatus.FOLLOWUP),
        ("Client Confirmation", InquiryStatus.CLIENT_CONFIRMATION),
        ("Menu Sent", InquiryStatus.MENU_SENT),
        ("Advance Receive", InquiryStatus.ADVANCE_RECEIVE),
        ("Operation Handover", InquiryStatus.OPERATION_HANDOVER),
    ]
    result = []
    for label, status in stages:
        count_result = await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == status))
        result.append({"stage": label, "count": count_result.scalar() or 0})
    return result


async def get_menu_planner_kpis(db: AsyncSession, user_id) -> dict:
    today = date.today()
    assigned = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status.notin_([InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER, InquiryStatus.CANCELLED])
    ))).scalar() or 0
    pending_menus = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status.in_([InquiryStatus.NEW_INQUIRY, InquiryStatus.FOLLOWUP])
    ))).scalar() or 0
    ai_generated = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status == InquiryStatus.MENU_SENT
    ))).scalar() or 0
    return {
        "assigned_inquiries": assigned,
        "pending_menus": pending_menus,
        "ai_menus_generated": ai_generated,
    }


async def get_presentation_kpis(db: AsyncSession, user_id) -> dict:
    today = date.today()
    assigned = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status.notin_([InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER, InquiryStatus.CANCELLED]),
        Inquiry.presentation_not_required.is_(False),
    ))).scalar() or 0
    new_inquiry_count = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status == InquiryStatus.NEW_INQUIRY,
        Inquiry.presentation_not_required.is_(False),
        Inquiry.presentation_file_name.is_(None),
    ))).scalar() or 0
    pending = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status.in_([InquiryStatus.NEW_INQUIRY, InquiryStatus.FOLLOWUP, InquiryStatus.MENU_SENT]),
        Inquiry.presentation_not_required.is_(False),
        Inquiry.presentation_file_name.is_(None),
    ))).scalar() or 0
    meetings_today = (await db.execute(select(func.count(Meeting.id)).where(
        func.date(Meeting.meeting_at) == today
    ))).scalar() or 0
    upcoming_end = today + timedelta(days=30)
    meetings_result = await db.execute(
        select(Meeting, Inquiry.client_name, Inquiry.event_type)
        .join(Inquiry, Meeting.inquiry_id == Inquiry.id)
        .where(func.date(Meeting.meeting_at) >= today, func.date(Meeting.meeting_at) <= upcoming_end)
        .order_by(Meeting.meeting_at.asc())
    )
    meetings = [
        {
            "id": str(m.id),
            "client_name": name,
            "event_type": event_type,
            "meeting_at": m.meeting_at.isoformat(),
            "remarks": m.remarks,
            "status": m.status,
        }
        for m, name, event_type in meetings_result.all()
    ]
    return {
        "new_inquiry": new_inquiry_count,
        "assigned_inquiries": assigned,
        "pending_presentations": pending,
        "client_meetings_today": meetings_today,
        "meetings": meetings,
    }


async def get_operations_kpis(db: AsyncSession) -> dict:
    today = date.today()
    handover = Inquiry.status == InquiryStatus.OPERATION_HANDOVER
    upcoming = (await db.execute(select(func.count(Inquiry.id)).where(
        handover,
        Inquiry.event_date >= today,
    ))).scalar() or 0
    today_events = (await db.execute(select(func.count(Inquiry.id)).where(
        handover,
        Inquiry.event_date == today,
    ))).scalar() or 0
    pending_kitchen = (await db.execute(select(func.count(Inquiry.id)).where(
        handover,
        Inquiry.kitchen_inventory_file_name.is_(None),
    ))).scalar() or 0
    pending_vendor = (await db.execute(select(func.count(Inquiry.id)).where(
        handover,
        Inquiry.vendor_file_name.is_(None),
    ))).scalar() or 0
    pending_warehouse = (await db.execute(select(func.count(WarehouseRequest.id)).where(
        WarehouseRequest.status == "pending",
    ))).scalar() or 0
    return {
        "upcoming_events": upcoming,
        "todays_events": today_events,
        "pending_kitchen_plans": pending_kitchen,
        "pending_vendor_requests": pending_vendor,
        "pending_warehouse_requests": pending_warehouse,
    }


async def get_kitchen_kpis(db: AsyncSession) -> dict:
    today = date.today()
    pending_plans = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status == InquiryStatus.OPERATION_HANDOVER
    ))).scalar() or 0
    todays_production = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.event_date == today,
        Inquiry.status == InquiryStatus.OPERATION_HANDOVER
    ))).scalar() or 0
    return {
        "pending_kitchen_plans": pending_plans,
        "todays_production": todays_production,
    }


async def get_warehouse_kpis(db: AsyncSession) -> dict:
    pending = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status == InquiryStatus.OPERATION_HANDOVER
    ))).scalar() or 0
    today_issues = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.event_date == date.today(),
        Inquiry.status == InquiryStatus.OPERATION_HANDOVER
    ))).scalar() or 0
    return {
        "pending_requests": pending,
        "todays_issues": today_issues,
        "stock_value": 0,
        "low_stock_items": 0,
    }
