# Lalit Operations Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Operations Manager (Lalit) experience in line with the PRD — real KPIs, All Inquiries table, PPT/Ingredient/Semi-finished downloads, Warehouse Request flow, Transfer Panel, Event Photos, Vendor Payment Status, and an Event Timeline. Quick Actions excluded per user.

**Architecture:** Backend gets two new tables (`warehouse_requests`, `event_photos`) and two new columns (`event_vendors.payment_status`, `inventory_movements.to_inquiry_id`) via Alembic migration `9030`. The event bundle (`build_event_bundle`) is extended with document file names, warehouse requests, photos, transfer-panel rows (returns/transfers/wastage), and a computed 6-stage timeline. The events router gains warehouse-request, photo, and direct-transfer endpoints. Operations KPIs become real counts instead of hardcoded 0. Frontend extends the event types/API/hooks, adds a 5th KPI + All Inquiries table to the Operations Dashboard, and adds new sections to EventView.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + pytest (backend); React + Vite + TanStack Query + TypeScript + Tailwind (frontend).

**Spec:** `docs/superpowers/specs/2026-08-13-lalit-operations-enhancements-design.md`

---

### Task 1: Migration + models

**Files:**
- Create: `backend/alembic/versions/9030_add_lalit_enhancements.py`
- Create: `backend/app/models/warehouse_request.py`
- Create: `backend/app/models/event_photo.py`
- Modify: `backend/app/models/event_vendor.py` (add `payment_status`)
- Modify: `backend/app/models/inventory_movement.py` (add `to_inquiry_id`)
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create the migration file**

Create `backend/alembic/versions/9030_add_lalit_enhancements.py`:

```python
"""add lalit operations enhancements (warehouse requests, event photos, vendor payment, transfer target)

Revision ID: 9030
Revises: 9029
Create Date: 2026-08-13 15:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9030"
down_revision: Union[str, None] = "9029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("event_vendors", sa.Column("payment_status", sa.String(length=20), nullable=False, server_default="unpaid"))
    op.add_column("inventory_movements", sa.Column("to_inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id"), nullable=True))

    op.create_table(
        "warehouse_requests",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("requested_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("issued_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("received_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "event_photos",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("uploaded_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("event_photos")
    op.drop_table("warehouse_requests")
    op.drop_column("inventory_movements", "to_inquiry_id")
    op.drop_column("event_vendors", "payment_status")
```

- [ ] **Step 2: Run the migration**

Run: `cd backend && python -m alembic upgrade head`
Expected: applies migration 9030; `python -m alembic heads` shows `9030 (head)`.

- [ ] **Step 3: Create `backend/app/models/warehouse_request.py`**

```python
import uuid
from sqlalchemy import String, Text, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class WarehouseRequest(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "warehouse_requests"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    requested_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    issued_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    received_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 4: Create `backend/app/models/event_photo.py`**

```python
import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class EventPhoto(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "event_photos"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
```

- [ ] **Step 5: Add columns to existing models**

Modify `backend/app/models/event_vendor.py` — add `payment_status` field (insert before `remark`):

```python
    total_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid", nullable=False)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
```

Modify `backend/app/models/inventory_movement.py` — add `to_inquiry_id` field (insert after `created_by`):

```python
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    to_inquiry_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("inquiries.id"), nullable=True
    )
```

- [ ] **Step 6: Register models in `__init__.py`**

Modify `backend/app/models/__init__.py` — add imports after the `kitchen_inventory_item` import (line 14):

```python
from app.models.warehouse_request import WarehouseRequest
from app.models.event_photo import EventPhoto
```

And add to `__all__` (after `"KitchenInventoryItem",`):

```python
    "WarehouseRequest",
    "EventPhoto",
```

- [ ] **Step 7: Verify imports + commit**

Run: `cd backend && python -c "from app.models import WarehouseRequest, EventPhoto, EventVendor, InventoryMovement; print('ok')"`
Expected: prints `ok`

```bash
git add backend/alembic/versions/9030_add_lalit_enhancements.py backend/app/models/warehouse_request.py backend/app/models/event_photo.py backend/app/models/event_vendor.py backend/app/models/inventory_movement.py backend/app/models/__init__.py
git commit -m "feat(db): warehouse requests, event photos, vendor payment status, transfer target"
```

---

### Task 2: Event schemas

**Files:**
- Modify: `backend/app/schemas/event.py`

- [ ] **Step 1: Add new schemas**

Modify `backend/app/schemas/event.py` — add imports at top (`date, datetime` already imported; no change needed) and add the new models after `EventDetail`:

```python
class WarehouseRequestRow(BaseModel):
    id: uuid.UUID
    item_name: str
    quantity: float = 0
    unit: str | None = None
    status: str = "pending"
    requested_by_name: str | None = None
    issued_by_name: str | None = None
    received_by_name: str | None = None
    notes: str | None = None
    created_at: datetime


class EventPhotoRow(BaseModel):
    id: uuid.UUID
    category: str
    file_name: str
    uploaded_at: datetime
    uploaded_by_name: str | None = None


class TransferRow(BaseModel):
    id: uuid.UUID
    item_name: str
    quantity: float = 0
    unit: str | None = None
    from_event: str
    to_event: str | None = None
    created_at: datetime


class TimelineStage(BaseModel):
    key: str
    label: str
    status: str
    date: datetime | None = None
    description: str | None = None


class WarehouseRequestItem(BaseModel):
    item_name: str
    quantity: float = 0
    unit: str | None = None


class WarehouseRequestCreate(BaseModel):
    from_ingredient: bool = False
    items: list[WarehouseRequestItem] | None = None


class TransferCreate(BaseModel):
    item_name: str
    quantity: float = 0
    unit: str | None = None
    to_inquiry_id: uuid.UUID
```

- [ ] **Step 2: Extend existing schemas**

Modify `EventVendorRow` to add `payment_status`:

```python
class EventVendorRow(BaseModel):
    id: uuid.UUID
    vendor_name: str
    service_name: str | None = None
    rate: float | None = None
    total_cost: float | None = None
    payment_status: str = "unpaid"
    remark: str | None = None
```

Modify `VendorSave` to add `payment_status`:

```python
class VendorSave(BaseModel):
    id: uuid.UUID
    rate: float | None = None
    total_cost: float | None = None
    payment_status: str | None = None
    remark: str | None = None
```

Modify `EventDetail` to add bundle fields (insert after `upload_history`):

```python
    upload_history: list[FileVersion] = []
    presentation_file_name: str | None = None
    ingredient_file_name: str | None = None
    kitchen_inventory_file_name: str | None = None
    warehouse_requests: list[WarehouseRequestRow] = []
    photos: list[EventPhotoRow] = []
    returns: list[TransferRow] = []
    transfers: list[TransferRow] = []
    wastage_rows: list[TransferRow] = []
    timeline: list[TimelineStage] = []
```

- [ ] **Step 3: Verify import + commit**

Run: `cd backend && python -c "from app.schemas.event import EventDetail, WarehouseRequestCreate, TransferCreate; print('ok')"`
Expected: prints `ok`

```bash
git add backend/app/schemas/event.py
git commit -m "feat(schemas): warehouse requests, photos, transfers, timeline, vendor payment status"
```

---

### Task 3: Event service — bundle additions + timeline

**Files:**
- Modify: `backend/app/services/event_service.py`

- [ ] **Step 1: Add imports**

Modify imports at the top of `backend/app/services/event_service.py` to add:

```python
import uuid
from datetime import date, timedelta
from app.models.settlement import Settlement, SettlementStatus
from app.models.warehouse_request import WarehouseRequest
from app.models.event_photo import EventPhoto
```

(Keep the existing imports unchanged.)

- [ ] **Step 2: Add helper functions**

Add the following helpers after `_status` (before `get_base_inventory_map`):

```python
async def _user_name_map(db: AsyncSession, user_ids: set[uuid]) -> dict[str, str]:
    if not user_ids:
        return {}
    result = await db.execute(select(User.id, User.full_name).where(User.id.in_(list(user_ids))))
    return {str(uid): name for uid, name in result.all()}


async def _inquiry_name_map(db: AsyncSession, inquiry_ids: set[uuid]) -> dict[str, str]:
    if not inquiry_ids:
        return {}
    result = await db.execute(select(Inquiry.id, Inquiry.client_name).where(Inquiry.id.in_(list(inquiry_ids))))
    return {str(iid): name for iid, name in result.all()}


def _build_timeline(
    inquiry: Inquiry,
    has_kitchen: bool,
    has_warehouse_request: bool,
    settlement_status: str | None,
    today: date,
) -> list[dict]:
    execution_date = None
    if inquiry.event_date:
        execution_date = inquiry.event_date - timedelta(days=1)
    return [
        {
            "key": "planning",
            "label": "Planning",
            "status": "completed",
            "date": inquiry.created_at,
            "description": "Inquiry converted to confirmed event",
        },
        {
            "key": "kitchen",
            "label": "Kitchen",
            "status": "completed" if has_kitchen else "pending",
            "date": None,
            "description": "Kitchen plan / ingredient list prepared",
        },
        {
            "key": "warehouse_request",
            "label": "Warehouse Request",
            "status": "completed" if has_warehouse_request else "pending",
            "date": None,
            "description": "Inventory requested from warehouse",
        },
        {
            "key": "execution",
            "label": "Execution",
            "status": "completed" if inquiry.is_completed else ("active" if execution_date and today >= execution_date else "pending"),
            "date": inquiry.completed_at if inquiry.is_completed else None,
            "description": "Event execution window",
        },
        {
            "key": "completion",
            "label": "Completion",
            "status": "completed" if inquiry.is_completed else ("active" if inquiry.event_date and today >= inquiry.event_date else "pending"),
            "date": inquiry.completed_at if inquiry.is_completed else None,
            "description": "Event execution finished",
        },
        {
            "key": "settlement",
            "label": "Settlement",
            "status": settlement_status or "pending",
            "date": None,
            "description": "Financial settlement for the event",
        },
    ]
```

- [ ] **Step 3: Extend `build_event_bundle`**

Inside `build_event_bundle`, after the `closure` dict is built and before the final `return`, add the warehouse request / photo / transfer / timeline queries:

```python
    wr_result = await db.execute(
        select(WarehouseRequest)
        .where(WarehouseRequest.inquiry_id == inquiry.id)
        .order_by(WarehouseRequest.created_at.asc())
    )
    warehouse_rows = wr_result.scalars().all()
    wr_user_ids = {r.requested_by for r in warehouse_rows}
    for r in warehouse_rows:
        if r.issued_by:
            wr_user_ids.add(r.issued_by)
        if r.received_by:
            wr_user_ids.add(r.received_by)
    wr_names = await _user_name_map(db, wr_user_ids)
    warehouse_requests = [
        {
            "id": str(r.id),
            "item_name": r.item_name,
            "quantity": r.quantity,
            "unit": r.unit,
            "status": r.status,
            "requested_by_name": wr_names.get(str(r.requested_by)),
            "issued_by_name": wr_names.get(str(r.issued_by)) if r.issued_by else None,
            "received_by_name": wr_names.get(str(r.received_by)) if r.received_by else None,
            "notes": r.notes,
            "created_at": r.created_at,
        }
        for r in warehouse_rows
    ]

    photo_result = await db.execute(
        select(EventPhoto, User.full_name)
        .join(User, EventPhoto.uploaded_by == User.id)
        .where(EventPhoto.inquiry_id == inquiry.id)
        .order_by(EventPhoto.created_at.desc())
    )
    photos = [
        {
            "id": str(p.id),
            "category": p.category,
            "file_name": p.file_name,
            "uploaded_at": p.created_at,
            "uploaded_by_name": name,
        }
        for p, name in photo_result.all()
    ]

    transfer_targets = await _inquiry_name_map(db, {m.to_inquiry_id for m in movements if m.to_inquiry_id})
    returns: list[dict] = []
    transfers: list[dict] = []
    wastage_rows: list[dict] = []
    for m in movements:
        if m.movement_type not in ("returned", "transferred", "wastage"):
            continue
        base = {
            "id": str(m.id),
            "item_name": m.item_name,
            "quantity": m.quantity,
            "unit": m.unit,
            "from_event": inquiry.client_name,
            "created_at": m.created_at,
        }
        if m.movement_type == "returned":
            returns.append(base)
        elif m.movement_type == "transferred":
            transfers.append({**base, "to_event": transfer_targets.get(str(m.to_inquiry_id)) if m.to_inquiry_id else None})
        else:
            wastage_rows.append(base)

    settlement_row = (
        await db.execute(select(Settlement).where(Settlement.inquiry_id == inquiry.id))
    ).scalar_one_or_none()
    settlement_status = None
    if settlement_row is not None:
        settlement_status = "active" if settlement_row.status == SettlementStatus.PENDING else "completed"
    timeline = _build_timeline(
        inquiry,
        has_kitchen=bool(inquiry.ingredient_file_path or inquiry.kitchen_inventory_file_path),
        has_warehouse_request=bool(warehouse_rows),
        settlement_status=settlement_status,
        today=date.today(),
    )
```

Then modify the final `return` dict to add the new keys after `"upload_history"`:

```python
        "upload_history": upload_history,
        "presentation_file_name": inquiry.presentation_file_name,
        "ingredient_file_name": inquiry.ingredient_file_name,
        "kitchen_inventory_file_name": inquiry.kitchen_inventory_file_name,
        "warehouse_requests": warehouse_requests,
        "photos": photos,
        "returns": returns,
        "transfers": transfers,
        "wastage_rows": wastage_rows,
        "timeline": timeline,
```

Also add `payment_status` to the vendor dicts (in the `"vendors"` list comprehension):

```python
                "total_cost": float(v.total_cost) if v.total_cost is not None else None,
                "payment_status": v.payment_status,
                "remark": v.remark,
```

- [ ] **Step 4: Verify import + commit**

Run: `cd backend && python -c "from app.services.event_service import build_event_bundle; print('ok')"`
Expected: prints `ok`

```bash
git add backend/app/services/event_service.py
git commit -m "feat(service): event bundle with docs, warehouse requests, photos, transfers, timeline"
```

---

### Task 4: Events router — new endpoints

**Files:**
- Modify: `backend/app/routers/events.py`

- [ ] **Step 1: Add imports**

Modify imports in `backend/app/routers/events.py` to add:

```python
from fastapi import File, Form, UploadFile
from app.models.inventory_movement import InventoryMovement
from app.models.warehouse_request import WarehouseRequest
from app.models.event_photo import EventPhoto
from app.schemas.event import WarehouseRequestCreate, TransferCreate
from app.services.event_service import _user_name_map, _inquiry_name_map
```

(Add `InventoryMovement`, `WarehouseRequest`, `EventPhoto` to the existing `app.models` imports block; keep existing imports unchanged.)

- [ ] **Step 2: Add a request lookup helper**

Add after `get_inquiry_or_404`:

```python
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
```

- [ ] **Step 3: Add warehouse-request endpoints**

Add these endpoints before the `complete_event` endpoint:

```python
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
            {"item_name": v["item_name"], "quantity": v["required_qty"], "unit": v["unit"]}
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
```

- [ ] **Step 4: Add photo endpoints**

Add after the warehouse-request endpoints:

```python
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
    file_path = os.path.join(upload_dir, file.filename or "unnamed")
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
```

- [ ] **Step 5: Add direct-transfer endpoints**

Add after the photo endpoints:

```python
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
```

- [ ] **Step 6: Verify import + commit**

Run: `cd backend && python -c "from app.routers.events import router; print('ok')"`
Expected: prints `ok`

```bash
git add backend/app/routers/events.py
git commit -m "feat(events): warehouse request flow, event photos, direct transfers endpoints"
```

---

### Task 5: Vendor payment status in save endpoint + operations KPIs

**Files:**
- Modify: `backend/app/routers/events.py` (`save_vendors`)
- Modify: `backend/app/services/dashboard_service.py`
- Modify: `backend/app/schemas/dashboard.py` (no change needed — `pending_vendor_requests` already exists)

- [ ] **Step 1: Update `save_vendors`**

Modify `backend/app/routers/events.py` — in `save_vendors`, replace the `changed` computation and the assignment block:

```python
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
```

- [ ] **Step 2: Update operations KPIs**

Modify `backend/app/services/dashboard_service.py` — add import at the top:

```python
from app.models.warehouse_request import WarehouseRequest
```

Replace the entire `get_operations_kpis` function:

```python
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
```

- [ ] **Step 3: Verify + commit**

Run: `cd backend && python -c "from app.services.dashboard_service import get_operations_kpis; from app.routers.events import router; print('ok')"`
Expected: prints `ok`

```bash
git add backend/app/routers/events.py backend/app/services/dashboard_service.py
git commit -m "feat(ops): vendor payment status save + real operations KPIs"
```

---

### Task 6: Backend integration tests

**Files:**
- Test: `backend/tests/test_events.py` (append new tests; reuse `login`, `auth`, `create_handover_inquiry`, `csv_upload`)

- [ ] **Step 1: Add warehouse-request lifecycle test**

Append to `backend/tests/test_events.py`:

```python
async def test_warehouse_request_lifecycle(client):
    admin_token = await login(client, "admin@shaguncatering.com", "admin123")
    warehouse_token = await login(client, "thol@shaguncatering.com", "thol123")
    kitchen_token = await login(client, "kitchen@shaguncatering.com", "kitchen123")
    inquiry_id = await create_handover_inquiry(client, admin_token)

    ingredient = csv_upload("ingredient.csv", "Item Name,Qty,Unit\nPaneer,10,kg\nRice,20,kg\n")
    resp = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(admin_token), files=ingredient)
    assert resp.status_code == 200, resp.text

    created = await client.post(f"/api/events/{inquiry_id}/warehouse-requests", headers=auth(admin_token), json={"from_ingredient": True})
    assert created.status_code == 200, created.text
    assert created.json()["created"] == 2

    listed = await client.get(f"/api/events/{inquiry_id}/warehouse-requests", headers=auth(admin_token))
    assert listed.status_code == 200
    rows = listed.json()
    assert len(rows) == 2
    assert all(r["status"] == "pending" for r in rows)

    request_id = rows[0]["id"]

    issued = await client.patch(f"/api/events/{inquiry_id}/warehouse-requests/{request_id}/issue", headers=auth(warehouse_token))
    assert issued.status_code == 200, issued.text
    assert issued.json()["status"] == "issued"

    received = await client.patch(f"/api/events/{inquiry_id}/warehouse-requests/{request_id}/receive", headers=auth(admin_token))
    assert received.status_code == 200, received.text
    assert received.json()["status"] == "received"

    # kitchen cannot issue
    forbidden = await client.patch(f"/api/events/{inquiry_id}/warehouse-requests/{request_id}/issue", headers=auth(kitchen_token))
    assert forbidden.status_code == 403

    # no ingredient plan -> 400
    other = await create_handover_inquiry(client, admin_token)
    bad = await client.post(f"/api/events/{other}/warehouse-requests", headers=auth(admin_token), json={"from_ingredient": True})
    assert bad.status_code == 400

    # completion lock
    complete = await client.post(f"/api/events/{inquiry_id}/complete", headers=auth(admin_token))
    assert complete.status_code == 200, complete.text
    locked = await client.post(f"/api/events/{inquiry_id}/warehouse-requests", headers=auth(admin_token), json={"from_ingredient": True})
    assert locked.status_code == 400
```

- [ ] **Step 2: Add photo upload + download test**

Append:

```python
async def test_photo_upload_and_download(client):
    admin_token = await login(client, "admin@shaguncatering.com", "admin123")
    sales_token = await login(client, "vinod@shaguncatering.com", "vinod123")
    inquiry_id = await create_handover_inquiry(client, admin_token)

    up = await client.post(
        f"/api/events/{inquiry_id}/photos",
        headers=auth(admin_token),
        data={"category": "before_setup"},
        files={"file": ("setup.jpg", b"\xff\xd8\xff\xe0fake-jpeg", "image/jpeg")},
    )
    assert up.status_code == 200, up.text
    photo_id = up.json()["id"]

    # bad category -> 400
    bad = await client.post(
        f"/api/events/{inquiry_id}/photos",
        headers=auth(admin_token),
        data={"category": "party"},
        files={"file": ("x.jpg", b"data", "image/jpeg")},
    )
    assert bad.status_code == 400

    # non-image -> 400
    nonimg = await client.post(
        f"/api/events/{inquiry_id}/photos",
        headers=auth(admin_token),
        data={"category": "setup"},
        files={"file": ("x.csv", b"a,b", "text/csv")},
    )
    assert nonimg.status_code == 400

    # sales cannot upload -> 403
    forbidden = await client.post(
        f"/api/events/{inquiry_id}/photos",
        headers=auth(sales_token),
        data={"category": "setup"},
        files={"file": ("x.jpg", b"data", "image/jpeg")},
    )
    assert forbidden.status_code == 403

    # bundle lists the photo
    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(admin_token))).json()
    assert len(detail["photos"]) == 1
    assert detail["photos"][0]["category"] == "before_setup"

    # download works
    dl = await client.get(f"/api/events/{inquiry_id}/photos/{photo_id}/download", headers=auth(admin_token))
    assert dl.status_code == 200
    assert dl.content == b"\xff\xd8\xff\xe0fake-jpeg"

    # scoping: wrong event -> 404
    other = await create_handover_inquiry(client, admin_token)
    other_dl = await client.get(f"/api/events/{other}/photos/{photo_id}/download", headers=auth(admin_token))
    assert other_dl.status_code == 404

    # completion lock
    complete = await client.post(f"/api/events/{inquiry_id}/complete", headers=auth(admin_token))
    assert complete.status_code == 200, complete.text
    locked = await client.post(
        f"/api/events/{inquiry_id}/photos",
        headers=auth(admin_token),
        data={"category": "setup"},
        files={"file": ("y.jpg", b"data", "image/jpeg")},
    )
    assert locked.status_code == 400
```

- [ ] **Step 3: Add direct-transfer + vendor payment + timeline tests**

Append:

```python
async def test_direct_transfer(client):
    admin_token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_a = await create_handover_inquiry(client, admin_token)
    inquiry_b = await create_handover_inquiry(client, admin_token)

    created = await client.post(f"/api/events/{inquiry_a}/transfers", headers=auth(admin_token), json={
        "item_name": "Steel Plate", "quantity": 50, "unit": "pcs", "to_inquiry_id": inquiry_b,
    })
    assert created.status_code == 200, created.text

    detail = (await client.get(f"/api/events/{inquiry_a}", headers=auth(admin_token))).json()
    assert len(detail["transfers"]) == 1
    assert detail["transfers"][0]["to_event"] is not None

    transfers = (await client.get(f"/api/events/{inquiry_a}/transfers", headers=auth(admin_token))).json()
    assert len(transfers) == 1
    assert transfers[0]["item_name"] == "Steel Plate"

    # self-transfer -> 400
    self_t = await client.post(f"/api/events/{inquiry_a}/transfers", headers=auth(admin_token), json={
        "item_name": "Plate", "quantity": 1, "to_inquiry_id": inquiry_a,
    })
    assert self_t.status_code == 400

    # missing target -> 404
    missing = await client.post(f"/api/events/{inquiry_a}/transfers", headers=auth(admin_token), json={
        "item_name": "Plate", "quantity": 1, "to_inquiry_id": str(uuid.uuid4()),
    })
    assert missing.status_code == 404

    # sales cannot create -> 403
    sales_token = await login(client, "vinod@shaguncatering.com", "vinod123")
    forbidden = await client.post(f"/api/events/{inquiry_a}/transfers", headers=auth(sales_token), json={
        "item_name": "Plate", "quantity": 1, "to_inquiry_id": inquiry_b,
    })
    assert forbidden.status_code == 403


async def test_vendor_payment_status_save(client):
    admin_token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, admin_token)

    vendor = csv_upload("vendor.csv", "Vendor Name,Service Name,Rate,Total Cost,Remark\nABC Catering,Staff,500,15000,staff team\n")
    resp = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=vendor", headers=auth(admin_token), files=vendor)
    assert resp.status_code == 200, resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(admin_token))).json()
    vendor_id = detail["vendors"][0]["id"]
    assert detail["vendors"][0]["payment_status"] == "unpaid"

    ok = await client.post(f"/api/events/{inquiry_id}/vendors", headers=auth(admin_token), json={
        "rows": [{"id": vendor_id, "rate": None, "total_cost": None, "payment_status": "paid", "remark": "paid in full"}]
    })
    assert ok.status_code == 200, ok.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(admin_token))).json()
    assert detail["vendors"][0]["payment_status"] == "paid"

    # changing payment_status without remark -> 400
    bad = await client.post(f"/api/events/{inquiry_id}/vendors", headers=auth(admin_token), json={
        "rows": [{"id": vendor_id, "rate": None, "total_cost": None, "payment_status": "unpaid", "remark": None}]
    })
    assert bad.status_code == 400


async def test_event_timeline_and_ops_kpis(client):
    admin_token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, admin_token)

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(admin_token))).json()
    stages = detail["timeline"]
    assert [s["key"] for s in stages] == ["planning", "kitchen", "warehouse_request", "execution", "completion", "settlement"]
    assert stages[0]["status"] == "completed"
    assert stages[1]["status"] == "pending"

    kitchen = csv_upload("kitchen.csv", "Item Name,Prepared Qty,Unit,Used Qty,Remaining Qty,Remark\nPaneer,50,kg,0,50,ok\n")
    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=kitchen_inventory", headers=auth(admin_token), files=kitchen)
    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(admin_token))).json()
    assert detail["timeline"][1]["status"] == "completed"

    kpis = (await client.get("/api/dashboard/operations", headers=auth(admin_token))).json()
    assert kpis["pending_kitchen_plans"] >= 1
    assert kpis["pending_vendor_requests"] >= 1

    await client.post(f"/api/events/{inquiry_id}/warehouse-requests", headers=auth(admin_token), json={"from_ingredient": False, "items": [{"item_name": "Gas Cylinder", "quantity": 2, "unit": "pc"}]})
    kpis = (await client.get("/api/dashboard/operations", headers=auth(admin_token))).json()
    assert kpis["pending_warehouse_requests"] >= 1
```

- [ ] **Step 4: Run the full backend suite**

Run: `cd backend && python -m pytest -v`
Expected: all existing + new tests pass (39 + 5 new = 44).

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_events.py
git commit -m "test(events): warehouse request flow, photos, transfers, vendor payment, timeline, ops KPIs"
```

---

### Task 7: Frontend types + API client + hooks

**Files:**
- Modify: `frontend/src/types/event.ts`
- Modify: `frontend/src/api/events.ts`
- Modify: `frontend/src/hooks/useEvents.ts`

- [ ] **Step 1: Extend types**

Modify `frontend/src/types/event.ts` — add `payment_status` to `EventVendorRow` and `VendorSave`:

```ts
export interface EventVendorRow {
  id: string
  vendor_name: string
  service_name: string | null
  rate: number | null
  total_cost: number | null
  payment_status: string
  remark: string | null
}
```

```ts
export interface VendorSave {
  id: string
  rate?: number | null
  total_cost?: number | null
  payment_status?: string | null
  remark?: string | null
}
```

Add new types after `VendorSave`:

```ts
export interface WarehouseRequestRow {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  status: string
  requested_by_name: string | null
  issued_by_name: string | null
  received_by_name: string | null
  notes: string | null
  created_at: string
}

export interface EventPhotoRow {
  id: string
  category: string
  file_name: string
  uploaded_at: string
  uploaded_by_name: string | null
}

export interface TransferRow {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  from_event: string
  to_event: string | null
  created_at: string
}

export interface TimelineStage {
  key: string
  label: string
  status: string
  date: string | null
  description: string | null
}
```

Extend `EventDetail` (add after `upload_history`):

```ts
  upload_history: FileVersion[]
  presentation_file_name: string | null
  ingredient_file_name: string | null
  kitchen_inventory_file_name: string | null
  warehouse_requests: WarehouseRequestRow[]
  photos: EventPhotoRow[]
  returns: TransferRow[]
  transfers: TransferRow[]
  wastage_rows: TransferRow[]
  timeline: TimelineStage[]
```

- [ ] **Step 2: Extend API client**

Modify `frontend/src/api/events.ts` — add import for the new payload types:

```ts
import type { EventListItem, EventDetail, InventoryItemSave, VendorSave, WarehouseRequestRow, TransferRow } from '@/types/event'
```

Append these functions (before or after `downloadUploadVersion`):

```ts
export async function createWarehouseRequests(
  id: string,
  payload: { from_ingredient: boolean; items?: { item_name: string; quantity: number; unit?: string | null }[] },
): Promise<{ ok: boolean; created: number }> {
  const response = await client.post(`/events/${id}/warehouse-requests`, payload)
  return response.data
}

export async function issueWarehouseRequest(id: string, requestId: string): Promise<{ ok: boolean; status: string }> {
  const response = await client.patch(`/events/${id}/warehouse-requests/${requestId}/issue`)
  return response.data
}

export async function receiveWarehouseRequest(id: string, requestId: string): Promise<{ ok: boolean; status: string }> {
  const response = await client.patch(`/events/${id}/warehouse-requests/${requestId}/receive`)
  return response.data
}

export async function getWarehouseRequests(id: string): Promise<WarehouseRequestRow[]> {
  const response = await client.get(`/events/${id}/warehouse-requests`)
  return response.data
}

export async function uploadEventPhoto(id: string, category: string, file: File): Promise<{ id: string; file_name: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('category', category)
  const response = await client.post(`/events/${id}/photos`, formData)
  return response.data
}

export async function getEventPhotoBlob(id: string, photoId: string): Promise<Blob> {
  const response = await client.get(`/events/${id}/photos/${photoId}/download`, { responseType: 'blob' })
  return response.data
}

export async function createTransfer(
  id: string,
  payload: { item_name: string; quantity: number; unit?: string | null; to_inquiry_id: string },
): Promise<{ ok: boolean }> {
  const response = await client.post(`/events/${id}/transfers`, payload)
  return response.data
}

export async function getTransfers(id: string): Promise<TransferRow[]> {
  const response = await client.get(`/events/${id}/transfers`)
  return response.data
}
```

- [ ] **Step 3: Extend hooks**

Modify `frontend/src/hooks/useEvents.ts` — update the import:

```ts
import type { InventoryItemSave, VendorSave } from '@/types/event'
```

Append hooks (keeping existing ones):

```ts
export function useWarehouseRequests(id: string) {
  return useQuery({
    queryKey: ['warehouse-requests', id],
    queryFn: () => eventsApi.getWarehouseRequests(id),
  })
}

export function useCreateWarehouseRequests(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { from_ingredient: boolean; items?: { item_name: string; quantity: number; unit?: string | null }[] }) =>
      eventsApi.createWarehouseRequests(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'operations'] })
    },
  })
}

export function useIssueWarehouseRequest(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => eventsApi.issueWarehouseRequest(id, requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-detail', id] }),
  })
}

export function useReceiveWarehouseRequest(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => eventsApi.receiveWarehouseRequest(id, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'operations'] })
    },
  })
}

export function useUploadEventPhoto(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ category, file }: { category: string; file: File }) => eventsApi.uploadEventPhoto(id, category, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-detail', id] }),
  })
}

export function useCreateTransfer(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { item_name: string; quantity: number; unit?: string | null; to_inquiry_id: string }) =>
      eventsApi.createTransfer(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-detail', id] }),
  })
}

export function useTransfers(id: string) {
  return useQuery({
    queryKey: ['transfers', id],
    queryFn: () => eventsApi.getTransfers(id),
  })
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `cd frontend && npx tsc -b`
Expected: no type errors.

```bash
git add frontend/src/types/event.ts frontend/src/api/events.ts frontend/src/hooks/useEvents.ts
git commit -m "feat(frontend): event types, api client, hooks for warehouse requests, photos, transfers"
```

---

### Task 8: Operations Dashboard — 5th KPI + All Inquiries table

**Files:**
- Modify: `frontend/src/pages/operations/OperationsDashboard.tsx`

- [ ] **Step 1: Add 5th KPI card**

Modify `OperationsDashboard.tsx` — change the KPI grid from `grid-cols-4` to `grid-cols-5`, and add the Pending Vendor Requests card to the array (after Pending Kitchen Plans):

```tsx
      <div className="grid grid-cols-5 gap-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: 'Upcoming Events', value: kpis?.upcoming_events ?? 0, color: 'text-blue-600', to: '/events' },
              { label: "Today's Events", value: kpis?.todays_events ?? 0, color: 'text-amber-600', to: '/events' },
              { label: 'Pending Kitchen Plans', value: kpis?.pending_kitchen_plans ?? 0, color: 'text-rose-600', to: '/events' },
              { label: 'Pending Vendor Requests', value: kpis?.pending_vendor_requests ?? 0, color: 'text-violet-600', to: '/events' },
              { label: 'Pending Warehouse Requests', value: kpis?.pending_warehouse_requests ?? 0, color: 'text-emerald-600', to: '/events' },
            ].map((kpi, i) => (
```

- [ ] **Step 2: Add All Inquiries table**

Add a new query in `OperationsDashboard.tsx` (after the existing `confirmedEvents`):

```tsx
  const { data: allInquiriesData } = useInquiries({ per_page: 10 })
  const allInquiries = allInquiriesData?.items ?? []
```

Add `INQUIRY_STATUSES` import — modify the import block:

```tsx
import { getErrorMessage } from '@/lib/apiError'
import { INQUIRY_STATUSES } from '@/lib/constants'
```

Add a new bottom section (after the Upcoming Events table, inside the returned JSX) — an All Inquiries table:

```tsx
      {/* All Inquiries Table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="flex overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md"
          style={{ height: 300, flexDirection: 'column' }}
        >
          <div className="shrink-0 border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-bold text-gray-900">All Inquiries</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Client Name', 'Number', 'Event Type', 'Function Date', 'Pax', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="bg-gray-50 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allInquiries.map((inq) => (
                  <tr key={inq.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-900">{inq.client_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.client_phone ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_type ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_date ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.pax ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.color ?? 'bg-gray-100 text-gray-700'
                      }`}>
                        {INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.label ?? inq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(inq.status === 'operation_handover' ? `/events/${inq.id}` : `/inquiries/${inq.id}`)}
                        className="rounded bg-maroon p-1.5 text-white hover:bg-maroon-dark"
                        title="Open detail">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd frontend && npx tsc -b`
Expected: no type errors.

```bash
git add frontend/src/pages/operations/OperationsDashboard.tsx
git commit -m "feat(ops dashboard): pending vendor requests KPI + all inquiries table"
```

---

### Task 9: EventView — documents, vendor payment, warehouse requests, transfer panel, photos, timeline

**Files:**
- Modify: `frontend/src/pages/events/EventView.tsx`

- [ ] **Step 1: Update imports**

Modify `EventView.tsx` imports:

```tsx
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  CheckCircle2,
  Lock,
  FileText,
  Loader2,
  Send,
  Truck,
  PackageCheck,
  ArrowRightLeft,
  Image as ImageIcon,
} from 'lucide-react'
```

Modify the api/hook imports:

```tsx
import { useEventDetail, useSaveInventoryItems, useSaveVendors, useCompleteEvent, useCreateWarehouseRequests, useIssueWarehouseRequest, useReceiveWarehouseRequest, useUploadEventPhoto, useCreateTransfer, useEvents } from '@/hooks/useEvents'
import { downloadInquiryFile, uploadInquiryFile } from '@/api/inquiries'
import { downloadUploadVersion, getEventPhotoBlob } from '@/api/events'
import type { EventInventoryRow, EventPhotoRow, EventVendorRow } from '@/types/event'
```

Add a `PHOTO_CATEGORIES` constant after the role constants:

```tsx
const PHOTO_CATEGORIES = [
  { key: 'before_setup', label: 'Before Event' },
  { key: 'setup', label: 'Setup Photo' },
  { key: 'after_cleaning', label: 'After Event Cleaning' },
] as const
```

- [ ] **Step 2: Add a PhotoThumb component**

Add before `export default function EventView()`:

```tsx
function PhotoThumb({ eventId, photo, onDownload }: { eventId: string; photo: EventPhotoRow; onDownload: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let objectUrl: string | null = null
    getEventPhotoBlob(eventId, photo.id)
      .then((blob) => {
        objectUrl = window.URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => setUrl(null))
    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl)
    }
  }, [eventId, photo.id])
  return (
    <div className="group relative">
      {url ? (
        <img src={url} alt={photo.file_name} className="h-24 w-24 rounded-lg border border-gray-200 object-cover" />
      ) : (
        <div className="h-24 w-24 rounded-lg border border-dashed border-gray-300 bg-gray-50" />
      )}
      <button
        onClick={onDownload}
        title={photo.file_name}
        className="mt-1 flex w-24 items-center justify-center gap-1 rounded border border-gray-200 px-1 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50"
      >
        <Download size={10} /> Download
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Wire up new hooks + transfer form state**

In `EventView` component, after the existing hooks:

```tsx
  const createRequests = useCreateWarehouseRequests(id)
  const issueRequest = useIssueWarehouseRequest(id)
  const receiveRequest = useReceiveWarehouseRequest(id)
  const uploadPhoto = useUploadEventPhoto(id)
  const createTransfer = useCreateTransfer(id)
  const { data: allEvents } = useEvents()

  const [transferForm, setTransferForm] = useState({ item_name: '', quantity: 0, unit: '', to_inquiry_id: '' })
```

Add helper handlers after `handleComplete`:

```tsx
  const handleSendToTHOL = () => {
    if (!window.confirm('Send the ingredient plan to THOL as a warehouse request?')) return
    createRequests.mutate({ from_ingredient: true }, {
      onSuccess: (res) => toast.success(`Warehouse request sent (${res.created} items)`),
      onError: (err) => toast.error(getErrorMessage(err, 'Failed to send request')),
    })
  }

  const handlePhotoUpload = (category: string, file?: File) => {
    if (!file) return
    uploadPhoto.mutate({ category, file }, {
      onSuccess: () => toast.success('Photo uploaded'),
      onError: (err) => toast.error(getErrorMessage(err, 'Upload failed')),
    })
  }

  const handleCreateTransfer = () => {
    if (!transferForm.item_name.trim() || transferForm.quantity <= 0 || !transferForm.to_inquiry_id) {
      toast.error('Item, quantity, and target event are required')
      return
    }
    createTransfer.mutate(
      {
        item_name: transferForm.item_name.trim(),
        quantity: transferForm.quantity,
        unit: transferForm.unit || null,
        to_inquiry_id: transferForm.to_inquiry_id,
      },
      {
        onSuccess: () => {
          toast.success('Transfer added')
          setTransferForm({ item_name: '', quantity: 0, unit: '', to_inquiry_id: '' })
        },
        onError: (err) => toast.error(getErrorMessage(err, 'Transfer failed')),
      },
    )
  }
```

- [ ] **Step 4: Documents section — add PPT / Ingredient / Semi-finished downloads**

Replace the entire Documents section (currently `{/* 2. Documents — Menu */}` block) with:

```tsx
      {/* 2. Documents */}
      <Section title="Documents">
        {[
          { label: 'Menu', uploaded: data.menu.uploaded, file_name: data.menu.file_name, onDownload: () => data.menu.file_name && downloadInquiryFile(id, 'menu', data.menu.file_name) },
          { label: 'Presentation (PPT)', uploaded: Boolean(data.presentation_file_name), file_name: data.presentation_file_name, onDownload: () => data.presentation_file_name && downloadInquiryFile(id, 'presentation', data.presentation_file_name) },
          { label: 'Ingredient Request', uploaded: Boolean(data.ingredient_file_name), file_name: data.ingredient_file_name, onDownload: () => data.ingredient_file_name && downloadInquiryFile(id, 'ingredient', data.ingredient_file_name) },
          { label: 'Semi-finished Item List', uploaded: Boolean(data.kitchen_inventory_file_name), file_name: data.kitchen_inventory_file_name, onDownload: () => data.kitchen_inventory_file_name && downloadInquiryFile(id, 'kitchen_inventory', data.kitchen_inventory_file_name) },
        ].map((doc) => (
          <div key={doc.label} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-emerald-500" />
              <span className="text-xs font-semibold text-gray-900">{doc.label}</span>
              {doc.uploaded ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Ready</span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={doc.onDownload}
                disabled={!doc.uploaded}
                className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-medium hover:bg-gray-50 disabled:opacity-40"
              >
                <Download size={12} /> Download
              </button>
            </div>
          </div>
        ))}
      </Section>
```

- [ ] **Step 5: Vendor panel — add Payment Status column**

Update `saveVendor` payload to include `payment_status`:

```tsx
  const saveVendor = () => {
    const payload = vendorRows.map((v) => {
      const orig = savedVendors.find((s) => s.id === v.id)
      const changed = orig && (v.rate !== orig.rate || v.total_cost !== orig.total_cost || v.payment_status !== orig.payment_status)
      return { id: v.id, rate: changed ? v.rate : null, total_cost: changed ? v.total_cost : null, payment_status: changed ? v.payment_status : null, remark: v.remark }
    })
    const missing = payload.filter((p) => (p.rate !== null || p.total_cost !== null || p.payment_status !== null) && !(p.remark || '').trim())
    if (missing.length > 0) {
      toast.error('Remark is mandatory when changing vendor rate/cost/status')
      return
    }
    saveVendors.mutate(payload, {
      onSuccess: () => toast.success('Vendors saved'),
      onError: (err) => toast.error(getErrorMessage(err, 'Save failed')),
    })
  }
```

Update the vendor table header + add a status select cell. Replace the header row in the Vendor Details section:

```tsx
                {['Sr No', 'Vendor Name', 'Service Name', 'Rate (₹)', 'Total Cost (₹)', 'Payment Status', 'Remark'].map((h) => (
```

Add `payment_status` to the `updateVendor` patch type usage — after the total-cost input cell, insert a status select cell:

```tsx
                  <td className="px-3 py-2.5">
                    <select
                      disabled={!canEdit}
                      value={v.payment_status}
                      onChange={(e) => updateVendor(v.id, { payment_status: e.target.value })}
                      className="rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </td>
```

Update `EventVendorRow` local state initialisation is handled by `useEffect` syncing `data.vendors` (which now includes `payment_status`). The `updateVendor` signature uses `Partial<EventVendorRow>` — already supports it.

- [ ] **Step 6: Add Warehouse Requests, Transfer Panel, Photos, and Timeline sections**

Insert these sections after the Kitchen Inventory section (`{/* 5. Kitchen Inventory */}` block) and before the Inventory Closure Summary. Add:

```tsx
      {/* 5b. Warehouse Requests */}
      <Section title="Warehouse Requests">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {canEdit && role === 'operations_manager' && !data.ingredient_file_name && (
            <p className="w-full text-xs text-amber-600">Upload the Ingredient Excel first, then send it to THOL.</p>
          )}
          {canEdit && (
            <button
              onClick={handleSendToTHOL}
              disabled={createRequests.isPending || !data.ingredient_file_name}
              className="flex items-center gap-1 rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white hover:bg-maroon-dark disabled:opacity-50"
            >
              {createRequests.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send Request to THOL
            </button>
          )}
        </div>
        {data.warehouse_requests.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No warehouse requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Item Name', 'Qty', 'Unit', 'Status', 'Requested By', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.warehouse_requests.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{r.item_name}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-gray-700">{r.quantity} {r.unit ?? ''}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{r.unit ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.status === 'received' ? 'bg-emerald-100 text-emerald-700'
                        : r.status === 'issued' ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{r.requested_by_name ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {role === 'warehouse' && !data.is_completed && r.status === 'pending' && (
                          <button
                            onClick={() => issueRequest.mutate(r.id, {
                              onSuccess: () => toast.success('Request issued'),
                              onError: (err) => toast.error(getErrorMessage(err, 'Issue failed')),
                            })}
                            disabled={issueRequest.isPending}
                            className="flex items-center gap-1 rounded border border-blue-200 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                          >
                            <Truck size={11} /> Issue
                          </button>
                        )}
                        {(role === 'operations_manager' || role === 'admin') && !data.is_completed && r.status !== 'received' && (
                          <button
                            onClick={() => receiveRequest.mutate(r.id, {
                              onSuccess: () => toast.success('Items received'),
                              onError: (err) => toast.error(getErrorMessage(err, 'Receive failed')),
                            })}
                            disabled={receiveRequest.isPending}
                            className="flex items-center gap-1 rounded border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <PackageCheck size={11} /> Receive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 5c. Transfer Panel */}
      <Section title="Transfer Panel">
        {canEdit && (
          <div className="mb-4 rounded-lg border border-gray-100 bg-cream p-3">
            <h4 className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <ArrowRightLeft size={11} /> Add Direct Transfer
            </h4>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Item Name</label>
                <input value={transferForm.item_name} onChange={(e) => setTransferForm((s) => ({ ...s, item_name: e.target.value }))}
                  className="mt-1 w-40 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Qty</label>
                <input type="number" value={transferForm.quantity} onChange={(e) => setTransferForm((s) => ({ ...s, quantity: Number(e.target.value) }))}
                  className="mt-1 w-20 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Unit</label>
                <input value={transferForm.unit} onChange={(e) => setTransferForm((s) => ({ ...s, unit: e.target.value }))}
                  className="mt-1 w-20 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Target Event</label>
                <select value={transferForm.to_inquiry_id} onChange={(e) => setTransferForm((s) => ({ ...s, to_inquiry_id: e.target.value }))}
                  className="mt-1 w-48 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none">
                  <option value="">Select event…</option>
                  {(allEvents ?? []).filter((ev) => ev.id !== id).map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.client_name} — {ev.event_date ?? 'no date'}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleCreateTransfer} disabled={createTransfer.isPending}
                className="flex items-center gap-1 rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white hover:bg-maroon-dark disabled:opacity-50">
                {createTransfer.isPending ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />} Add
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { title: 'Items Returned', rows: data.returns, cols: ['Item', 'Qty', 'Event', 'Date'] },
            { title: 'Direct Transfers', rows: data.transfers, cols: ['Item', 'Qty', 'From', 'To', 'Date'] },
            { title: 'Wastage', rows: data.wastage_rows, cols: ['Item', 'Qty', 'Event', 'Date'] },
          ].map((panel) => (
            <div key={panel.title} className="rounded-lg border border-gray-100 bg-white">
              <div className="border-b border-gray-100 px-3 py-2">
                <h4 className="text-xs font-bold text-gray-900">{panel.title}</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {panel.cols.map((h) => (
                        <th key={h} className="px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {panel.rows.length === 0 ? (
                      <tr><td colSpan={panel.cols.length} className="px-2 py-6 text-center text-[11px] text-gray-400">None</td></tr>
                    ) : panel.rows.map((row: any) => (
                      <tr key={row.id} className="border-b border-gray-50">
                        <td className="px-2 py-2 text-[11px] font-medium text-gray-900">{row.item_name}</td>
                        <td className="px-2 py-2 text-[11px] tabular-nums text-gray-700">{row.quantity} {row.unit ?? ''}</td>
                        <td className="px-2 py-2 text-[11px] text-gray-600">{panel.title === 'Direct Transfers' ? row.from_event : row.from_event}</td>
                        {panel.title === 'Direct Transfers' && <td className="px-2 py-2 text-[11px] text-gray-600">{row.to_event ?? '—'}</td>}
                        <td className="px-2 py-2 text-[11px] text-gray-600">{row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 5d. Photos */}
      <Section title="Photos">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PHOTO_CATEGORIES.map((cat) => {
            const items = data.photos.filter((p) => p.category === cat.key)
            return (
              <div key={cat.key} className="rounded-lg border border-gray-100 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                  <h4 className="flex items-center gap-1 text-xs font-bold text-gray-900"><ImageIcon size={12} /> {cat.label}</h4>
                  {canEdit && (
                    <label className="flex cursor-pointer items-center gap-1 rounded border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50">
                      <Upload size={10} /> Upload
                      <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp"
                        onChange={(e) => { handlePhotoUpload(cat.key, e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 p-3">
                  {items.length === 0 ? (
                    <p className="w-full py-4 text-center text-[11px] text-gray-400">No photos yet.</p>
                  ) : items.map((p) => (
                    <PhotoThumb key={p.id} eventId={id} photo={p} onDownload={() => downloadEventPhoto(id, p.id, p.file_name)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* 5e. Event Timeline */}
      <Section title="Event Timeline">
        <ol className="space-y-0">
          {data.timeline.map((stage, idx) => (
            <li key={stage.key} className="relative flex gap-3 pb-5">
              {idx < data.timeline.length - 1 && <span className="absolute left-[9px] top-5 h-full w-px bg-gray-200" />}
              <span className={`mt-0.5 h-[19px] w-[19px] shrink-0 rounded-full border-2 ${
                stage.status === 'completed' ? 'border-emerald-500 bg-emerald-500'
                : stage.status === 'active' ? 'border-blue-500 bg-white'
                : 'border-gray-300 bg-white'
              }`}>
                {stage.status === 'completed' && <CheckCircle2 size={14} className="text-white" />}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900">
                  {stage.label}{' '}
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                    stage.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                    : stage.status === 'active' ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                  }`}>{stage.status}</span>
                </p>
                {stage.description && <p className="mt-0.5 text-[11px] text-gray-500">{stage.description}</p>}
                {stage.date && <p className="mt-0.5 text-[10px] text-gray-400">{new Date(stage.date).toLocaleString('en-IN')}</p>}
              </div>
            </li>
          ))}
        </ol>
      </Section>
```

Also update the `downloadEventPhoto` usage — add it to the imports from `@/api/events`:

```tsx
import { downloadUploadVersion, getEventPhotoBlob, downloadEventPhoto } from '@/api/events'
```

Add `downloadEventPhoto` to `frontend/src/api/events.ts` (append):

```ts
export async function downloadEventPhoto(id: string, photoId: string, fileName?: string | null): Promise<void> {
  const response = await client.get(`/events/${id}/photos/${photoId}/download`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName || `photo_${photoId}`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
```

- [ ] **Step 7: Typecheck + build**

Run: `cd frontend && npm run build`
Expected: TypeScript + Vite build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/events/EventView.tsx frontend/src/api/events.ts
git commit -m "feat(events view): documents, vendor payment status, warehouse requests, transfer panel, photos, timeline"
```

---

### Task 10: Full verification + final commit

**Files:**
- Verify: backend tests, frontend build

- [ ] **Step 1: Run backend tests**

Run: `cd backend && python -m pytest -v`
Expected: all tests pass (44 total).

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Spec cross-check**

Verify each spec item maps to a task:
1. 5 KPI cards incl. Pending Vendor Requests (real) → Task 8, Task 5.
2. All Inquiries table → Task 8.
3. Menu + PPT + Ingredient + Semi-finished downloads → Task 9 (Task 3 bundle).
4. Warehouse Request flow (create → issue → receive) → Task 4, Task 9.
5. Transfer Panel (returns/transfers/wastage + direct transfer create) → Task 3, Task 4, Task 9.
6. Photos (3 categories, upload + view + download) → Task 4, Task 9.
7. Vendor Payment Status column → Task 5, Task 9.
8. Event Timeline (6 stages) → Task 3, Task 9.
9. Quick Actions — intentionally skipped.

- [ ] **Step 4: Final commit (any leftover)**

```bash
git add -A
git commit -m "chore: lalit operations enhancements feature complete"
```
