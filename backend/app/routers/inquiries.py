import uuid
import math
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.database import get_db
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus, FollowUp
from app.models.user import User
from app.schemas.inquiry import InquiryCreate, InquiryUpdate, InquiryResponse, FollowUpCreate, FollowUpResponse
from app.schemas.common import PaginatedResponse
from app.middleware.auth import get_current_user

from app.services.inquiry_service import can_transition, get_inquiry_or_404
import os
from fastapi import UploadFile, File
from app.config import settings

router = APIRouter(prefix="/api/inquiries", tags=["inquiries"])


def apply_filters(query, count_query, status, assigned_to, search, event_type, date_from, date_to):
    if status:
        query = query.where(Inquiry.status == status)
        count_query = count_query.where(Inquiry.status == status)
    if assigned_to:
        query = query.where(Inquiry.assigned_to == assigned_to)
        count_query = count_query.where(Inquiry.assigned_to == assigned_to)
    if event_type:
        query = query.where(Inquiry.event_type.ilike(f"%{event_type}%"))
        count_query = count_query.where(Inquiry.event_type.ilike(f"%{event_type}%"))
    if search:
        search_filter = or_(Inquiry.client_name.ilike(f"%{search}%"), Inquiry.client_phone.ilike(f"%{search}%"))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    if date_from:
        query = query.where(Inquiry.inquiry_date >= date.fromisoformat(date_from))
        count_query = count_query.where(Inquiry.inquiry_date >= date.fromisoformat(date_from))
    if date_to:
        query = query.where(Inquiry.inquiry_date <= date.fromisoformat(date_to))
        count_query = count_query.where(Inquiry.inquiry_date <= date.fromisoformat(date_to))
    return query, count_query


@router.get("", response_model=PaginatedResponse[InquiryResponse])
async def list_inquiries(
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    status: str | None = None, assigned_to: uuid.UUID | None = None,
    search: str | None = None, event_type: str | None = None,
    date_from: str | None = None, date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Inquiry)
    count_query = select(func.count(Inquiry.id))
    query, count_query = apply_filters(query, count_query, status, assigned_to, search, event_type, date_from, date_to)
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


@router.get("/export/excel")
async def export_inquiries_excel(
    status: str | None = None, assigned_to: uuid.UUID | None = None,
    search: str | None = None, event_type: str | None = None,
    date_from: str | None = None, date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from openpyxl import Workbook
    from io import BytesIO

    query = select(Inquiry)
    count_query = select(func.count(Inquiry.id))
    query, _ = apply_filters(query, count_query, status, assigned_to, search, event_type, date_from, date_to)
    query = query.order_by(Inquiry.created_at.desc())
    result = await db.execute(query)
    inquiries = result.scalars().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Inquiries"
    ws.append(["Client Name", "Phone", "Event Type", "Pax", "Per Plate Rate", "Add On",
               "Total Amount", "Inquiry Date", "Event Date", "Status", "Payment Status",
               "Advance Amount", "Remarks"])

    for i in inquiries:
        total = (float(i.per_plate_rate or 0) * (i.pax or 0)) + float(i.add_on or 0)
        ws.append([
            i.client_name, i.client_phone, i.event_type, i.pax,
            float(i.per_plate_rate or 0), float(i.add_on or 0),
            total,
            i.inquiry_date.isoformat() if i.inquiry_date else "",
            i.event_date.isoformat() if i.event_date else "",
            i.status.value if hasattr(i.status, 'value') else i.status,
            i.payment_status.value if hasattr(i.payment_status, 'value') else i.payment_status,
            float(i.advance_amount), i.remarks or "",
        ])

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=inquiries.xlsx"},
    )


@router.get("/{inquiry_id}/export/excel")
async def export_single_inquiry_excel(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from openpyxl import Workbook
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    inquiry = await get_inquiry_or_404(db, inquiry_id)

    wb = Workbook()
    ws = wb.active
    ws.title = "Inquiry"
    ws.append(["Field", "Value"])
    ws.append(["Client Name", inquiry.client_name])
    ws.append(["Phone", inquiry.client_phone])
    ws.append(["Event Type", inquiry.event_type])
    ws.append(["Pax", inquiry.pax])
    ws.append(["Per Plate Rate", float(inquiry.per_plate_rate or 0)])
    ws.append(["Add On", float(inquiry.add_on or 0)])
    ws.append(["Total Amount", (float(inquiry.per_plate_rate or 0) * (inquiry.pax or 0)) + float(inquiry.add_on or 0)])
    ws.append(["Inquiry Date", inquiry.inquiry_date.isoformat() if inquiry.inquiry_date else ""])
    ws.append(["Event Date", inquiry.event_date.isoformat() if inquiry.event_date else ""])
    ws.append(["Status", inquiry.status.value if hasattr(inquiry.status, 'value') else inquiry.status])
    ws.append(["Payment Status", inquiry.payment_status.value if hasattr(inquiry.payment_status, 'value') else inquiry.payment_status])
    ws.append(["Advance Amount", float(inquiry.advance_amount)])
    ws.append(["Remarks", inquiry.remarks or ""])

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=inquiry_{inquiry.client_name}.xlsx"},
    )


@router.get("/{inquiry_id}", response_model=InquiryResponse)
async def get_inquiry(inquiry_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    return InquiryResponse.model_validate(inquiry)


@router.get("/{inquiry_id}/menu/download")
async def download_menu(inquiry_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if not inquiry.menu_content:
        raise HTTPException(status_code=404, detail="No menu content available")
    from fastapi.responses import Response
    filename = f"Menu_{inquiry.client_name.replace(' ', '_')}.txt"
    return Response(
        content=inquiry.menu_content,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


ALLOWED_ROLES = {
    "menu": {"admin", "menu_planner"},
    "presentation": {"admin", "presentation_exec"},
}


@router.post("/{inquiry_id}/upload")
async def upload_inquiry_file(
    inquiry_id: uuid.UUID,
    file_type: str = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file_type not in ("menu", "presentation"):
        raise HTTPException(status_code=400, detail="file_type must be 'menu' or 'presentation'")
    if current_user.role.name not in ALLOWED_ROLES[file_type]:
        raise HTTPException(status_code=403, detail="Not authorized")
    inquiry = await get_inquiry_or_404(db, inquiry_id)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not allowed")
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")

    upload_dir = os.path.join(settings.UPLOAD_DIR, str(inquiry_id), file_type)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename or "unnamed")
    with open(file_path, "wb") as f:
        f.write(content)

    setattr(inquiry, f"{file_type}_file_name", file.filename)
    setattr(inquiry, f"{file_type}_file_path", file_path)
    await db.commit()
    await db.refresh(inquiry)

    return {"file_name": file.filename, "file_path": file_path}


@router.get("/{inquiry_id}/file/{file_type}")
async def download_inquiry_file(
    inquiry_id: uuid.UUID,
    file_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file_type not in ("menu", "presentation"):
        raise HTTPException(status_code=400, detail="file_type must be 'menu' or 'presentation'")
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    file_path = getattr(inquiry, f"{file_type}_file_path", None)
    file_name = getattr(inquiry, f"{file_type}_file_name", None)
    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="No file uploaded")
    from fastapi.responses import FileResponse
    return FileResponse(
        path=file_path,
        filename=file_name,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.post("", response_model=InquiryResponse, status_code=201)
async def create_inquiry(data: InquiryCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = Inquiry(
        id=uuid.uuid4(), client_name=data.client_name, client_phone=data.client_phone,
        event_type=data.event_type, event_date=data.event_date, pax=data.pax,
        per_plate_rate=data.per_plate_rate, add_on=data.add_on,
        assigned_to=data.assigned_to, remarks=data.remarks,
        created_by=current_user.id,
        status=InquiryStatus.FOLLOWUP if data.follow_up_date else InquiryStatus.NEW_INQUIRY,
        payment_status=PaymentStatus.UNPAID,
    )
    db.add(inquiry)
    await db.flush()

    if data.follow_up_date:
        follow_up = FollowUp(
            id=uuid.uuid4(), inquiry_id=inquiry.id,
            follow_up_date=data.follow_up_date,
            created_by=current_user.id,
        )
        db.add(follow_up)

    await db.commit()
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


@router.get("/{inquiry_id}/follow-ups", response_model=list[FollowUpResponse])
async def list_follow_ups(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FollowUp)
        .where(FollowUp.inquiry_id == inquiry_id)
        .order_by(FollowUp.follow_up_date.asc())
    )
    return [FollowUpResponse.model_validate(fu) for fu in result.scalars().all()]


@router.post("/{inquiry_id}/follow-ups", response_model=FollowUpResponse, status_code=201)
async def add_follow_up(
    inquiry_id: uuid.UUID, data: FollowUpCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    follow_up = FollowUp(
        id=uuid.uuid4(), inquiry_id=inquiry.id,
        follow_up_date=data.follow_up_date,
        remarks=data.remarks,
        created_by=current_user.id,
    )
    if inquiry.status == InquiryStatus.NEW_INQUIRY:
        inquiry.status = InquiryStatus.FOLLOWUP
    db.add(follow_up)
    await db.commit()
    await db.refresh(follow_up)
    return FollowUpResponse.model_validate(follow_up)


@router.patch("/{inquiry_id}/status")
async def update_status(inquiry_id: uuid.UUID, new_status: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    target_status = InquiryStatus(new_status)
    if not can_transition(inquiry.status, target_status):
        raise HTTPException(status_code=400, detail=f"Cannot transition from '{inquiry.status.value}' to '{target_status.value}'")
    if target_status == InquiryStatus.MENU_SENT and current_user.role.name not in ("admin", "menu_planner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin or menu planner can set Menu Sent")
    inquiry.status = target_status
    await db.flush()
    return {"message": f"Status updated to {target_status.value}"}


@router.patch("/{inquiry_id}/payment")
async def update_payment(inquiry_id: uuid.UUID, payment_status: str, advance_amount: float | None = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.status not in (InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER):
        raise HTTPException(status_code=400, detail="Payment can only be updated after advance receive")
    inquiry.payment_status = PaymentStatus(payment_status)
    if advance_amount is not None:
        from decimal import Decimal
        inquiry.advance_amount = Decimal(str(advance_amount))
    await db.flush()
    return {"message": f"Payment status updated to {payment_status}"}
