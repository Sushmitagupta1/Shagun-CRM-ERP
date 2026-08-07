import uuid
import math
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.settlement import Settlement, SettlementStatus
from app.models.inquiry import Inquiry, InquiryStatus
from app.models.user import User
from app.schemas.settlement import SettlementCreate, SettlementUpdate, SettlementResponse
from app.schemas.common import PaginatedResponse
from app.middleware.auth import require_role
from app.services.settlement_service import calculate_net_profit, get_finance_stats

router = APIRouter(prefix="/api/settlements", tags=["settlements"])


@router.get("", response_model=PaginatedResponse[SettlementResponse])
async def list_settlements(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100), status: str | None = None, date_from: str | None = None, date_to: str | None = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    query = select(Settlement, Inquiry.client_name).join(Inquiry, Settlement.inquiry_id == Inquiry.id)
    count_query = select(func.count(Settlement.id))
    if status:
        query = query.where(Settlement.status == status)
        count_query = count_query.where(Settlement.status == status)
    if date_from:
        query = query.where(Settlement.created_at >= datetime.fromisoformat(date_from))
        count_query = count_query.where(Settlement.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.where(Settlement.created_at <= datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59))
        count_query = count_query.where(Settlement.created_at <= datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59))
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    query = query.order_by(Settlement.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    rows = result.all()
    items = []
    for s, client_name in rows:
        resp = SettlementResponse.model_validate(s)
        resp.client_name = client_name
        items.append(resp)
    return PaginatedResponse(
        items=items,
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/summary")
async def settlement_summary(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    return await get_finance_stats(db)


@router.get("/{settlement_id}", response_model=SettlementResponse)
async def get_settlement(settlement_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    result = await db.execute(select(Settlement).where(Settlement.id == settlement_id))
    settlement = result.scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found")
    return SettlementResponse.model_validate(settlement)


@router.get("/event/{inquiry_id}", response_model=SettlementResponse)
async def get_settlement_by_event(inquiry_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    result = await db.execute(select(Settlement).where(Settlement.inquiry_id == inquiry_id))
    settlement = result.scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=404, detail="No settlement found for this event")
    return SettlementResponse.model_validate(settlement)


@router.post("", response_model=SettlementResponse, status_code=201)
async def create_settlement(data: SettlementCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    inquiry_result = await db.execute(select(Inquiry).where(Inquiry.id == data.inquiry_id))
    inquiry = inquiry_result.scalar_one_or_none()
    if inquiry is None:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if inquiry.status not in (InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.OPERATION_HANDOVER):
        raise HTTPException(status_code=400, detail="Can only create settlement for confirmed events")
    existing = await db.execute(select(Settlement).where(Settlement.inquiry_id == data.inquiry_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Settlement already exists for this event")
    net_profit = await calculate_net_profit(data.revenue, data.vendor_cost, data.other_expenses)
    settlement = Settlement(id=uuid.uuid4(), inquiry_id=data.inquiry_id, revenue=data.revenue, vendor_cost=data.vendor_cost, other_expenses=data.other_expenses, net_profit=net_profit, status=SettlementStatus.PENDING, notes=data.notes, created_by=current_user.id)
    db.add(settlement)
    await db.flush()
    await db.refresh(settlement)
    return SettlementResponse.model_validate(settlement)


@router.put("/{settlement_id}", response_model=SettlementResponse)
async def update_settlement(settlement_id: uuid.UUID, data: SettlementUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    result = await db.execute(select(Settlement).where(Settlement.id == settlement_id))
    settlement = result.scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settlement, field, value)
    settlement.net_profit = await calculate_net_profit(settlement.revenue, settlement.vendor_cost, settlement.other_expenses)
    await db.flush()
    await db.refresh(settlement)
    return SettlementResponse.model_validate(settlement)


@router.patch("/{settlement_id}/status")
async def complete_settlement(settlement_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    result = await db.execute(select(Settlement).where(Settlement.id == settlement_id))
    settlement = result.scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found")
    settlement.status = SettlementStatus.COMPLETED
    await db.flush()
    return {"message": "Settlement marked as completed"}


@router.get("/export/excel")
async def export_settlements(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    from openpyxl import Workbook
    from io import BytesIO
    result = await db.execute(select(Settlement).order_by(Settlement.created_at.desc()))
    settlements = result.scalars().all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Settlements"
    ws.append(["ID", "Inquiry ID", "Revenue", "Vendor Cost", "Other Expenses", "Net Profit", "Status", "Notes", "Created At"])
    for s in settlements:
        ws.append([str(s.id), str(s.inquiry_id), float(s.revenue), float(s.vendor_cost), float(s.other_expenses), float(s.net_profit), s.status.value, s.notes or "", s.created_at.isoformat()])
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=settlements.xlsx"})
