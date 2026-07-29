import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.database import get_db
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus
from app.models.user import User
from app.schemas.inquiry import InquiryCreate, InquiryUpdate, InquiryResponse
from app.schemas.common import PaginatedResponse
from app.middleware.auth import get_current_user
from app.services.inquiry_service import can_transition, get_inquiry_or_404

router = APIRouter(prefix="/api/inquiries", tags=["inquiries"])


@router.get("", response_model=PaginatedResponse[InquiryResponse])
async def list_inquiries(
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    status: str | None = None, assigned_to: uuid.UUID | None = None,
    search: str | None = None, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Inquiry)
    count_query = select(func.count(Inquiry.id))
    if status:
        query = query.where(Inquiry.status == status)
        count_query = count_query.where(Inquiry.status == status)
    if assigned_to:
        query = query.where(Inquiry.assigned_to == assigned_to)
        count_query = count_query.where(Inquiry.assigned_to == assigned_to)
    if search:
        search_filter = or_(Inquiry.client_name.ilike(f"%{search}%"), Inquiry.client_phone.ilike(f"%{search}%"))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    query = query.order_by(Inquiry.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    inquiries = result.scalars().all()
    return PaginatedResponse(
        items=[InquiryResponse.model_validate(i) for i in inquiries],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{inquiry_id}", response_model=InquiryResponse)
async def get_inquiry(inquiry_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    return InquiryResponse.model_validate(inquiry)


@router.post("", response_model=InquiryResponse, status_code=201)
async def create_inquiry(data: InquiryCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = Inquiry(
        id=uuid.uuid4(), client_name=data.client_name, client_phone=data.client_phone,
        event_type=data.event_type, event_date=data.event_date, pax=data.pax, per_plate_rate=data.per_plate_rate, add_on=data.add_on,
        assigned_to=data.assigned_to, follow_up_date=data.follow_up_date, remarks=data.remarks,
        created_by=current_user.id, status=InquiryStatus.NEW, payment_status=PaymentStatus.UNPAID,
    )
    db.add(inquiry)
    await db.flush()
    await db.refresh(inquiry)
    return InquiryResponse.model_validate(inquiry)


@router.put("/{inquiry_id}", response_model=InquiryResponse)
async def update_inquiry(inquiry_id: uuid.UUID, data: InquiryUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(inquiry, field, value)
    await db.flush()
    await db.refresh(inquiry)
    return InquiryResponse.model_validate(inquiry)


@router.patch("/{inquiry_id}/status")
async def update_status(inquiry_id: uuid.UUID, new_status: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    target_status = InquiryStatus(new_status)
    if not can_transition(inquiry.status, target_status):
        raise HTTPException(status_code=400, detail=f"Cannot transition from '{inquiry.status.value}' to '{target_status.value}'")
    inquiry.status = target_status
    await db.flush()
    return {"message": f"Status updated to {target_status.value}"}


@router.patch("/{inquiry_id}/payment")
async def update_payment(inquiry_id: uuid.UUID, payment_status: str, advance_amount: float | None = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.status != InquiryStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Payment can only be updated for confirmed inquiries")
    inquiry.payment_status = PaymentStatus(payment_status)
    if advance_amount is not None:
        from decimal import Decimal
        inquiry.advance_amount = Decimal(str(advance_amount))
    await db.flush()
    return {"message": f"Payment status updated to {payment_status}"}
