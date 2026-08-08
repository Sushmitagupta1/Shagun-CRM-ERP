import uuid
import math
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.database import get_db
from app.models.notification import Notification
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus
from app.models.menu_slot import MenuSlot
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.schemas.common import PaginatedResponse
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

EVENT_REMINDER_ROLES = {"admin", "sales_head", "menu_planner", "presentation_exec", "operations_manager", "kitchen", "warehouse"}

CONFIRMED_STATUSES = [
    InquiryStatus.CLIENT_CONFIRMATION,
    InquiryStatus.ADVANCE_RECEIVE,
    InquiryStatus.OPERATION_HANDOVER,
]

UPCOMING_WINDOW_DAYS = 90


async def ensure_upcoming_event_notifications(db: AsyncSession, user: User) -> None:
    if user.role.name not in EVENT_REMINDER_ROLES:
        return
    today = date.today()
    window_end = today + timedelta(days=UPCOMING_WINDOW_DAYS)
    query = select(Inquiry).where(
        Inquiry.event_date.isnot(None),
        Inquiry.event_date >= today,
        Inquiry.event_date <= window_end,
        Inquiry.status != InquiryStatus.CANCELLED,
    )
    # Menu planners (Vishal) only need reminders for confirmed functions.
    if user.role.name == "menu_planner":
        query = query.where(Inquiry.status.in_(CONFIRMED_STATUSES))
    result = await db.execute(query)
    inquiries = result.scalars().all()
    if not inquiries:
        return
    existing_result = await db.execute(
        select(Notification.entity_id).where(
            Notification.user_id == user.id,
            Notification.type == "event",
            Notification.entity_type == "inquiry",
        )
    )
    existing_ids = {row[0] for row in existing_result.all()}
    created = []
    for inq in inquiries:
        if inq.id in existing_ids:
            continue
        days = (inq.event_date - today).days
        if days == 0:
            title = "Event today"
        elif days == 1:
            title = "Event tomorrow"
        else:
            title = f"Event in {days} days"
        message = f"{inq.client_name} {inq.event_type} — {inq.event_date.strftime('%d %b %Y')}, {inq.pax or '—'} guests"
        created.append(
            Notification(
                user_id=user.id,
                title=title,
                message=message,
                type="event",
                entity_type="inquiry",
                entity_id=inq.id,
            )
        )
    if created:
        db.add_all(created)
        await db.commit()


async def ensure_payment_menu_notifications(db: AsyncSession, user: User) -> None:
    if user.role.name != "admin":
        return
    today = date.today()

    existing_result = await db.execute(
        select(Notification.entity_id).where(
            Notification.user_id == user.id,
            Notification.type == "payment",
            Notification.entity_type == "inquiry",
        )
    )
    payment_existing = {row[0] for row in existing_result.all()}
    existing_result = await db.execute(
        select(Notification.entity_id).where(
            Notification.user_id == user.id,
            Notification.type == "menu_pending",
            Notification.entity_type == "inquiry",
        )
    )
    menu_existing = {row[0] for row in existing_result.all()}

    created = []
    due_result = await db.execute(
        select(Inquiry).where(
            Inquiry.status.in_([
                InquiryStatus.CLIENT_CONFIRMATION,
                InquiryStatus.ADVANCE_RECEIVE,
                InquiryStatus.OPERATION_HANDOVER,
            ]),
            Inquiry.payment_status != PaymentStatus.PAID,
        )
    )
    for inq in due_result.scalars().all():
        if inq.id in payment_existing:
            continue
        days = (inq.remaining_payment_date - today).days if inq.remaining_payment_date else None
        if days is not None and days > 7:
            continue
        if days is not None and days >= 0:
            title = f"Payment due in {days} day{'s' if days != 1 else ''}"
        elif days is not None:
            title = "Payment overdue"
        else:
            title = "Payment pending"
        message = f"{inq.client_name} {inq.event_type} — payment not received"
        created.append(
            Notification(
                user_id=user.id,
                title=title,
                message=message[:500],
                type="payment",
                entity_type="inquiry",
                entity_id=inq.id,
            )
        )

    confirmed_result = await db.execute(
        select(Inquiry).where(
            Inquiry.status.in_([InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER]),
            Inquiry.menu_file_name.is_(None),
        )
    )
    confirmed_inquiries = confirmed_result.scalars().all()
    final_slot_ids: set = set()
    if confirmed_inquiries:
        ids = [i.id for i in confirmed_inquiries]
        slot_result = await db.execute(
            select(MenuSlot.inquiry_id).where(
                MenuSlot.inquiry_id.in_(ids), MenuSlot.is_final.is_(True)
            )
        )
        final_slot_ids = {row[0] for row in slot_result.all()}
    for inq in confirmed_inquiries:
        if inq.id in final_slot_ids or inq.id in menu_existing:
            continue
        days = (inq.event_date - today).days if inq.event_date else None
        title = "Menu pending" if days is None or days >= 0 else "Menu pending"
        message = f"{inq.client_name} {inq.event_type} — final menu not uploaded yet"
        created.append(
            Notification(
                user_id=user.id,
                title=title,
                message=message[:500],
                type="menu_pending",
                entity_type="inquiry",
                entity_id=inq.id,
            )
        )

    if created:
        db.add_all(created)
        await db.commit()


@router.get("", response_model=PaginatedResponse[NotificationResponse])
async def list_notifications(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100), unread_only: bool = False, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await ensure_upcoming_event_notifications(db, current_user)
    await ensure_payment_menu_notifications(db, current_user)
    query = select(Notification).where(Notification.user_id == current_user.id)
    count_query = select(func.count(Notification.id)).where(Notification.user_id == current_user.id)
    # Menu planners only see event reminders for confirmed inquiries.
    if current_user.role.name == "menu_planner":
        confirmed_ids = select(Inquiry.id).where(Inquiry.status.in_(CONFIRMED_STATUSES))
        query = query.where(
            (Notification.type != "event") | Notification.entity_id.in_(confirmed_ids)
        )
        count_query = count_query.where(
            (Notification.type != "event") | Notification.entity_id.in_(confirmed_ids)
        )
    if unread_only:
        query = query.where(Notification.is_read == False)
        count_query = count_query.where(Notification.is_read == False)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    query = query.order_by(Notification.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    notifications = result.scalars().all()
    return PaginatedResponse(
        items=[NotificationResponse.model_validate(n) for n in notifications],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.patch("/{notification_id}/read")
async def mark_read(notification_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id))
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await db.flush()
    return {"message": "Marked as read"}


@router.patch("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await db.execute(update(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False).values(is_read=True))
    await db.flush()
    return {"message": "All notifications marked as read"}
