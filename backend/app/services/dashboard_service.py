from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus


async def get_admin_kpis(db: AsyncSession) -> dict:
    today = date.today()
    total = (await db.execute(select(func.count(Inquiry.id)))).scalar() or 0
    confirmed = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CONFIRMED))).scalar() or 0
    cancelled = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CANCELLED))).scalar() or 0
    upcoming = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.event_date >= today, Inquiry.status == InquiryStatus.CONFIRMED))).scalar() or 0
    today_events = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.event_date == today, Inquiry.status == InquiryStatus.CONFIRMED))).scalar() or 0
    pending_payment = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CONFIRMED, Inquiry.payment_status != PaymentStatus.PAID))).scalar() or 0
    total_revenue = (await db.execute(select(func.coalesce(func.sum(Inquiry.advance_amount), 0)))).scalar() or 0
    outstanding = (await db.execute(select(func.coalesce(func.sum(Inquiry.per_plate_rate - Inquiry.advance_amount), 0)).where(Inquiry.status == InquiryStatus.CONFIRMED, Inquiry.payment_status != PaymentStatus.PAID))).scalar() or 0
    return {
        "total_inquiries": total, "confirmed": confirmed,
        "cancelled": cancelled, "upcoming_events": upcoming,
        "today_events": today_events, "pending_payments": pending_payment,
        "total_revenue": float(total_revenue), "outstanding_amount": float(outstanding),
        "pending_kitchen_plans": 0, "pending_warehouse_requests": 0,
    }


async def get_sales_kpis(db: AsyncSession) -> dict:
    today = date.today()
    new = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.NEW))).scalar() or 0
    followups_today = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.follow_up_date == today))).scalar() or 0
    overdue = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.follow_up_date < today, Inquiry.status.in_([InquiryStatus.NEW, InquiryStatus.FOLLOW_UP])))).scalar() or 0
    confirmed_count = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CONFIRMED))).scalar() or 0
    cancelled_count = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CANCELLED))).scalar() or 0
    presentations = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.PRESENTATION_SENT))).scalar() or 0
    menus = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.MENU_READY))).scalar() or 0
    pending_payment = (await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CONFIRMED, Inquiry.payment_status != PaymentStatus.PAID))).scalar() or 0
    total_sales = (await db.execute(select(func.coalesce(func.sum(Inquiry.per_plate_rate), 0)).where(Inquiry.status == InquiryStatus.CONFIRMED))).scalar() or 0
    total_count = (await db.execute(select(func.count(Inquiry.id)))).scalar() or 0
    conversion_rate = (confirmed_count / total_count * 100) if total_count > 0 else 0
    return {
        "new_inquiries": new, "followups_today": followups_today,
        "overdue_followups": overdue, "confirmed": confirmed_count,
        "cancelled": cancelled_count, "pending_presentations": presentations,
        "pending_menus": menus, "pending_payments": pending_payment,
        "total_sales_value": float(total_sales), "conversion_rate": round(conversion_rate, 1),
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
    stages = [("Lead", InquiryStatus.NEW), ("Follow Up", InquiryStatus.FOLLOW_UP), ("Menu Ready", InquiryStatus.MENU_READY), ("Presentation Sent", InquiryStatus.PRESENTATION_SENT), ("Negotiation", InquiryStatus.NEGOTIATION), ("Confirmed", InquiryStatus.CONFIRMED)]
    result = []
    for label, status in stages:
        count_result = await db.execute(select(func.count(Inquiry.id)).where(Inquiry.status == status))
        result.append({"stage": label, "count": count_result.scalar() or 0})
    return result


async def get_menu_planner_kpis(db: AsyncSession, user_id) -> dict:
    today = date.today()
    assigned = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.assigned_to == user_id,
        Inquiry.status.notin_([InquiryStatus.CONFIRMED, InquiryStatus.CANCELLED])
    ))).scalar() or 0
    pending_menus = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.assigned_to == user_id,
        Inquiry.status.in_([InquiryStatus.NEW, InquiryStatus.FOLLOW_UP, InquiryStatus.MENU_READY])
    ))).scalar() or 0
    ai_generated = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.assigned_to == user_id,
        Inquiry.status == InquiryStatus.MENU_READY
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
        Inquiry.status.notin_([InquiryStatus.CONFIRMED, InquiryStatus.CANCELLED])
    ))).scalar() or 0
    pending = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.assigned_to == user_id,
        Inquiry.status.in_([InquiryStatus.NEW, InquiryStatus.FOLLOW_UP, InquiryStatus.MENU_READY])
    ))).scalar() or 0
    meetings_today = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.event_date == today,
        Inquiry.status.in_([InquiryStatus.CONFIRMED, InquiryStatus.NEGOTIATION, InquiryStatus.PRESENTATION_SENT])
    ))).scalar() or 0
    return {
        "assigned_inquiries": assigned,
        "pending_presentations": pending,
        "client_meetings_today": meetings_today,
    }


async def get_operations_kpis(db: AsyncSession) -> dict:
    today = date.today()
    upcoming = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.event_date >= today,
        Inquiry.status == InquiryStatus.CONFIRMED
    ))).scalar() or 0
    today_events = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.event_date == today,
        Inquiry.status == InquiryStatus.CONFIRMED
    ))).scalar() or 0
    pending_kitchen = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status == InquiryStatus.CONFIRMED,
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
        Inquiry.status == InquiryStatus.CONFIRMED
    ))).scalar() or 0
    todays_production = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.event_date == today,
        Inquiry.status == InquiryStatus.CONFIRMED
    ))).scalar() or 0
    return {
        "pending_kitchen_plans": pending_plans,
        "todays_production": todays_production,
    }


async def get_warehouse_kpis(db: AsyncSession) -> dict:
    pending = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.status == InquiryStatus.CONFIRMED
    ))).scalar() or 0
    today_issues = (await db.execute(select(func.count(Inquiry.id)).where(
        Inquiry.event_date == date.today(),
        Inquiry.status == InquiryStatus.CONFIRMED
    ))).scalar() or 0
    return {
        "pending_requests": pending,
        "todays_issues": today_issues,
        "stock_value": 0,
        "low_stock_items": 0,
    }
