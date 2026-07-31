from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus, FollowUp, Meeting


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
    return {
        "total_inquiries": total, "confirmed": total_confirmed,
        "cancelled": 0, "upcoming_events": upcoming,
        "today_events": today_events, "pending_payments": pending_payment,
        "total_revenue": float(total_revenue), "outstanding_amount": float(outstanding),
        "pending_kitchen_plans": 0, "pending_warehouse_requests": 0,
    }


async def get_sales_kpis(db: AsyncSession) -> dict:
    today = date.today()
    new_inquiry = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.NEW_INQUIRY))).scalar() or 0
    followups_today = (await db.execute(
        select(func.count(FollowUp.id)).where(FollowUp.follow_up_date == today)
    )).scalar() or 0
    overdue = (await db.execute(
        select(func.count(FollowUp.id))
        .join(Inquiry, FollowUp.inquiry_id == Inquiry.id)
        .where(FollowUp.follow_up_date < today, Inquiry.status.in_([InquiryStatus.NEW_INQUIRY, InquiryStatus.FOLLOWUP]))
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
        .where(FollowUp.follow_up_date >= today)
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

    return {
        "total_inquiries": total_count, "new_inquiries": new_inquiry, "followups_today": followups_today,
        "overdue_followups": overdue, "confirmed": confirmed_count,
        "cancelled": 0, "pending_presentations": 0,
        "pending_menus": 0, "pending_payments": pending_payment,
        "total_sales_value": float(total_sales), "conversion_rate": round(conversion_rate, 1),
        "next_follow_up": next_follow_up_info,
    }


async def get_monthly_trend(db: AsyncSession) -> list:
    result = await db.execute(
        select(func.to_char(Inquiry.created_at, 'YYYY-MM').label('month'), func.count(Inquiry.id).label('count'))
        .group_by('month').order_by('month').limit(12)
    )
    return [{"month": row.month, "count": row.count} for row in result.all()]


async def get_status_distribution(db: AsyncSession) -> list:
    result = await db.execute(select(Inquiry.status, func.count(Inquiry.id).label('count')).group_by(Inquiry.status))
    return [{"status": row.status.value, "count": row.count} for row in result.all()]


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
        Inquiry.assigned_to == user_id,
        Inquiry.status.notin_([InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER, InquiryStatus.CANCELLED])
    ))).scalar() or 0
    new_inquiry_count = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.assigned_to == user_id,
        Inquiry.status == InquiryStatus.NEW_INQUIRY
    ))).scalar() or 0
    pending = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.assigned_to == user_id,
        Inquiry.status.in_([InquiryStatus.NEW_INQUIRY, InquiryStatus.FOLLOWUP, InquiryStatus.MENU_SENT])
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
    upcoming = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.event_date >= today,
        Inquiry.status == InquiryStatus.OPERATION_HANDOVER
    ))).scalar() or 0
    today_events = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.event_date == today,
        Inquiry.status == InquiryStatus.OPERATION_HANDOVER
    ))).scalar() or 0
    pending_kitchen = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status == InquiryStatus.OPERATION_HANDOVER,
        Inquiry.event_date >= today
    ))).scalar() or 0
    return {
        "upcoming_events": upcoming,
        "todays_events": today_events,
        "pending_kitchen_plans": pending_kitchen,
        "pending_vendor_requests": 0,
        "pending_warehouse_requests": 0,
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
