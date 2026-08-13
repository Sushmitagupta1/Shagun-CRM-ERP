import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.config import settings
from app.database import get_db
from app.models.inquiry import Inquiry, InquiryStatus
from app.models.user import User
from app.models.event_inventory_item import EventInventoryItem
from app.models.event_vendor import EventVendor
from app.models.inventory_file_version import InventoryFileVersion
from app.models.inventory_movement import InventoryMovement
from app.models.warehouse_request import WarehouseRequest
from app.models.event_photo import EventPhoto
from app.schemas.event import (
    EventListItem,
    EventDetail,
    InventoryItemsSaveRequest,
    VendorsSaveRequest,
    WarehouseRequestCreate,
    TransferCreate,
    WarehouseRequestItem,
)
from app.services.event_service import build_event_bundle, get_base_inventory_map, _user_name_map, _inquiry_name_map
from app.middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/events", tags=["events"])


async def get_inquiry_or_404(db: AsyncSession, inquiry_id: uuid.UUID) -> Inquiry:
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inquiry = result.scalar_one_or_none()
    if inquiry is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return inquiry


async def get_warehouse_request_or_404(db: AsyncSession, inquiry_id: uuid.UUID, request_id: uuid.UUID) -> WarehouseRequest:
    result = await db.execute(
        select(WarehouseRequest).where(
            WarehouseRequest.id == request_id,
            WarehouseRequest.inquiry_id == inquiry_id,
        )
    )
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Warehouse request not found")
    return req


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


@router.get("/{inquiry_id}/uploads/{version_id}/download")
async def download_upload_version(
    inquiry_id: uuid.UUID,
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager", "kitchen", "warehouse")),
):
    await get_inquiry_or_404(db, inquiry_id)
    result = await db.execute(
        select(InventoryFileVersion).where(
            InventoryFileVersion.id == version_id,
            InventoryFileVersion.inquiry_id == inquiry_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="File not found")
    path = Path(version.file_path).resolve()
    upload_root = Path(settings.UPLOAD_DIR).resolve()
    if not str(path).startswith(str(upload_root)) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=version.file_name)


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
            or (row.payment_status is not None and vendor.payment_status != row.payment_status)
        )
        if changed and not (row.remark or "").strip():
            raise HTTPException(status_code=400, detail=f"Remark is mandatory when changing vendor '{vendor.vendor_name}'")
        if row.rate is not None:
            vendor.rate = row.rate
        if row.total_cost is not None:
            vendor.total_cost = row.total_cost
        if row.payment_status is not None:
            vendor.payment_status = row.payment_status
        vendor.remark = row.remark

    await db.commit()
    return {"ok": True}


@router.post("/{inquiry_id}/warehouse-requests")
async def create_warehouse_requests(
    inquiry_id: uuid.UUID,
    data: WarehouseRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")
    items = data.items
    if data.from_ingredient:
        base_map = await get_base_inventory_map(db, inquiry)
        if not base_map:
            raise HTTPException(status_code=400, detail="No ingredient plan uploaded for this event")
        items = [
            WarehouseRequestItem(item_name=v["item_name"], quantity=v["required_qty"], unit=v["unit"])
            for v in base_map.values()
        ]
    if not items:
        raise HTTPException(status_code=400, detail="No items to request")
    created = 0
    for it in items:
        if not it.item_name.strip():
            continue
        db.add(WarehouseRequest(
            inquiry_id=inquiry_id,
            item_name=it.item_name.strip(),
            quantity=it.quantity,
            unit=it.unit,
            status="pending",
            requested_by=current_user.id,
        ))
        created += 1
    await db.commit()
    return {"ok": True, "created": created}


@router.get("/{inquiry_id}/warehouse-requests")
async def list_warehouse_requests(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await get_inquiry_or_404(db, inquiry_id)
    result = await db.execute(
        select(WarehouseRequest)
        .where(WarehouseRequest.inquiry_id == inquiry_id)
        .order_by(WarehouseRequest.created_at.asc())
    )
    rows = result.scalars().all()
    user_ids = {r.requested_by for r in rows}
    for r in rows:
        if r.issued_by:
            user_ids.add(r.issued_by)
        if r.received_by:
            user_ids.add(r.received_by)
    names = await _user_name_map(db, user_ids)
    return [
        {
            "id": str(r.id),
            "item_name": r.item_name,
            "quantity": r.quantity,
            "unit": r.unit,
            "status": r.status,
            "requested_by_name": names.get(str(r.requested_by)),
            "issued_by_name": names.get(str(r.issued_by)) if r.issued_by else None,
            "received_by_name": names.get(str(r.received_by)) if r.received_by else None,
            "notes": r.notes,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.patch("/{inquiry_id}/warehouse-requests/{request_id}/issue")
async def issue_warehouse_request(
    inquiry_id: uuid.UUID,
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "warehouse")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")
    req = await get_warehouse_request_or_404(db, inquiry_id, request_id)
    if req.status == "received":
        raise HTTPException(status_code=400, detail="Request already received")
    req.status = "issued"
    req.issued_by = current_user.id
    await db.commit()
    return {"ok": True, "status": req.status}


@router.patch("/{inquiry_id}/warehouse-requests/{request_id}/receive")
async def receive_warehouse_request(
    inquiry_id: uuid.UUID,
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")
    req = await get_warehouse_request_or_404(db, inquiry_id, request_id)
    req.status = "received"
    req.received_by = current_user.id
    await db.commit()
    return {"ok": True, "status": req.status}


@router.post("/{inquiry_id}/photos")
async def upload_event_photo(
    inquiry_id: uuid.UUID,
    file: UploadFile = File(...),
    category: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")
    if category not in ("before_setup", "setup", "after_cleaning"):
        raise HTTPException(status_code=400, detail="category must be one of: before_setup, setup, after_cleaning")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(inquiry_id), "photos", category)
    os.makedirs(upload_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(upload_dir, stored_name)
    with open(file_path, "wb") as f:
        f.write(content)
    photo = EventPhoto(
        inquiry_id=inquiry_id,
        category=category,
        file_name=file.filename or "unnamed",
        file_path=file_path,
        uploaded_by=current_user.id,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return {"id": str(photo.id), "file_name": photo.file_name}


@router.get("/{inquiry_id}/photos")
async def list_event_photos(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await get_inquiry_or_404(db, inquiry_id)
    result = await db.execute(
        select(EventPhoto, User.full_name)
        .join(User, EventPhoto.uploaded_by == User.id)
        .where(EventPhoto.inquiry_id == inquiry_id)
        .order_by(EventPhoto.created_at.desc())
    )
    return [
        {
            "id": str(p.id),
            "category": p.category,
            "file_name": p.file_name,
            "uploaded_at": p.created_at,
            "uploaded_by_name": name,
        }
        for p, name in result.all()
    ]


@router.get("/{inquiry_id}/photos/{photo_id}/download")
async def download_event_photo(
    inquiry_id: uuid.UUID,
    photo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await get_inquiry_or_404(db, inquiry_id)
    result = await db.execute(
        select(EventPhoto).where(
            EventPhoto.id == photo_id,
            EventPhoto.inquiry_id == inquiry_id,
        )
    )
    photo = result.scalar_one_or_none()
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    path = Path(photo.file_path).resolve()
    upload_root = Path(settings.UPLOAD_DIR).resolve()
    if not str(path).startswith(str(upload_root)) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(path, filename=photo.file_name)


@router.post("/{inquiry_id}/transfers")
async def create_transfer(
    inquiry_id: uuid.UUID,
    data: TransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")
    if str(data.to_inquiry_id) == str(inquiry_id):
        raise HTTPException(status_code=400, detail="Target event must differ from the source event")
    target = await db.execute(select(Inquiry).where(Inquiry.id == data.to_inquiry_id))
    if target.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Target event not found")
    db.add(InventoryMovement(
        inquiry_id=inquiry_id,
        movement_type="transferred",
        item_name=data.item_name,
        quantity=data.quantity,
        unit=data.unit,
        to_inquiry_id=data.to_inquiry_id,
        created_by=current_user.id,
    ))
    await db.commit()
    return {"ok": True}


@router.get("/{inquiry_id}/transfers")
async def list_transfers(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    result = await db.execute(
        select(InventoryMovement)
        .where(
            InventoryMovement.inquiry_id == inquiry_id,
            InventoryMovement.movement_type == "transferred",
        )
        .order_by(InventoryMovement.created_at.desc())
    )
    rows = result.scalars().all()
    target_names = await _inquiry_name_map(db, {m.to_inquiry_id for m in rows if m.to_inquiry_id})
    return [
        {
            "id": str(m.id),
            "item_name": m.item_name,
            "quantity": m.quantity,
            "unit": m.unit,
            "from_event": inquiry.client_name,
            "to_event": target_names.get(str(m.to_inquiry_id)) if m.to_inquiry_id else None,
            "created_at": m.created_at,
        }
        for m in rows
    ]


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
