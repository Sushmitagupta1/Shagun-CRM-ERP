import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.inquiry import Inquiry, InquiryStatus
from app.models.user import User
from app.models.event_inventory_item import EventInventoryItem
from app.models.event_vendor import EventVendor
from app.schemas.event import EventListItem, EventDetail, InventoryItemsSaveRequest, VendorsSaveRequest
from app.services.event_service import build_event_bundle, get_base_inventory_map
from app.middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/events", tags=["events"])


async def get_inquiry_or_404(db: AsyncSession, inquiry_id: uuid.UUID) -> Inquiry:
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inquiry = result.scalar_one_or_none()
    if inquiry is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return inquiry


@router.get("", response_model=list[EventListItem])
async def list_events(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Inquiry)
        .where(Inquiry.status == InquiryStatus.OPERATION_HANDOVER)
        .order_by(Inquiry.event_date.asc())
    )
    return [
        EventListItem(
            id=i.id,
            client_name=i.client_name,
            event_type=i.event_type,
            event_date=i.event_date,
            venue=i.venue,
            pax=i.pax,
            status=i.status.value if hasattr(i.status, "value") else str(i.status),
            is_completed=i.is_completed,
        )
        for i in result.scalars().all()
    ]


@router.get("/{inquiry_id}", response_model=EventDetail)
async def get_event_detail(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    return await build_event_bundle(db, inquiry)


@router.post("/{inquiry_id}/inventory-items")
async def save_inventory_items(
    inquiry_id: uuid.UUID,
    data: InventoryItemsSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager", "warehouse")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")

    base_map = await get_base_inventory_map(db, inquiry)

    existing_result = await db.execute(
        select(EventInventoryItem).where(EventInventoryItem.inquiry_id == inquiry_id)
    )
    existing = {o.item_name.strip().lower(): o for o in existing_result.scalars().all()}

    for row in data.rows:
        base = base_map.get(row.item_name.strip().lower())
        if base is None:
            raise HTTPException(status_code=400, detail=f"Item '{row.item_name}' not found in required plan")
        ov = existing.get(row.item_name.strip().lower())
        current_received = ov.received_qty if ov is not None and ov.received_qty is not None else base["received_qty"]
        current_transfer = ov.transfer_count if ov is not None and ov.transfer_count is not None else base["transfer_count"]
        current_returned = ov.returned_qty if ov is not None and ov.returned_qty is not None else base["returned_qty"]

        changed = (
            (row.received_qty is not None and row.received_qty != current_received)
            or (row.transfer_count is not None and row.transfer_count != current_transfer)
            or (row.returned_qty is not None and row.returned_qty != current_returned)
        )
        if changed and not (row.remark or "").strip():
            raise HTTPException(status_code=400, detail=f"Remark is mandatory when changing '{row.item_name}'")

        if ov is None:
            ov = EventInventoryItem(inquiry_id=inquiry_id, item_name=base["item_name"])
            db.add(ov)
            existing[row.item_name.strip().lower()] = ov
        if row.received_qty is not None:
            ov.received_qty = row.received_qty
        if row.transfer_count is not None:
            ov.transfer_count = row.transfer_count
        if row.returned_qty is not None:
            ov.returned_qty = row.returned_qty
        ov.remark = row.remark

    await db.commit()
    return {"ok": True}


@router.post("/{inquiry_id}/vendors")
async def save_vendors(
    inquiry_id: uuid.UUID,
    data: VendorsSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager", "warehouse")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")

    for row in data.rows:
        result = await db.execute(select(EventVendor).where(EventVendor.id == row.id, EventVendor.inquiry_id == inquiry_id))
        vendor = result.scalar_one_or_none()
        if vendor is None:
            raise HTTPException(status_code=404, detail=f"Vendor {row.id} not found")
        changed = (
            (row.rate is not None and vendor.rate is not None and float(row.rate) != float(vendor.rate))
            or (row.total_cost is not None and vendor.total_cost is not None and float(row.total_cost) != float(vendor.total_cost))
        )
        if changed and not (row.remark or "").strip():
            raise HTTPException(status_code=400, detail=f"Remark is mandatory when changing vendor '{vendor.vendor_name}'")
        if row.rate is not None:
            vendor.rate = row.rate
        if row.total_cost is not None:
            vendor.total_cost = row.total_cost
        vendor.remark = row.remark

    await db.commit()
    return {"ok": True}


@router.post("/{inquiry_id}/complete")
async def complete_event(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event already completed")
    inquiry.is_completed = True
    inquiry.completed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
