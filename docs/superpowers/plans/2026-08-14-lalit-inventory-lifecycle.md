# Lalit Inventory Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the EventView inventory module into a complete ops lifecycle (Required Qty editing, Not Received counts, Received All / Returned to THOL bulk actions, Breakage, Received Tag, per-field audit trail) and expose view-only inventory to kitchen/warehouse dashboards.

**Architecture:** Extend the existing `event_inventory_items` table with new ops columns (`required_qty`, `not_received_count`, `breakage_count`, `transfer_event`) plus a new structured `event_audit_logs` table. `build_event_bundle` becomes the single source of truth: it reads persisted `EventInventoryItem` rows (falling back to live ingredient-excel parse for legacy events) and computes `received_qty`/`received_tag`/closure totals. New PATCH + bulk-action endpoints write both the ops columns and audit rows. The EventView table switches from batch "Save with remark" editing to per-cell PATCH editing; kitchen/warehouse dashboards get a read-only event inventory section.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Pydantic; React 18 + Vite + TanStack Query + Tailwind; Railway deploy (`railway up`).

**Single source of truth:** `docs/superpowers/specs/2026-08-14-lalit-inventory-lifecycle-design.md`. Note the design-doc clarification already applied: `received_qty` is a **stored** field (default `0`) set only by the **Received All Inventory** button to `max(required_qty − not_received_count, 0)`; `received_tag` is computed from `received_qty` vs `required_qty`.

**Rules enforced (from spec):**
- 4.1 `required_qty` edits require a remark (PATCH returns 400 without one).
- 4.2 Ops columns (`not_received_count`, `transfer_count`, `breakage_count`, `returned_qty`, `transfer_event`) do NOT require a remark.
- 4.3 All edits are locked after `is_completed` (400).
- `received_qty` is never typed by the user — only the bulk button writes it.
- `returned_qty` is never typed by the user — only "All Items Returned to THOL" writes it as `max(required − not_received − transfer_count, 0)`.

---

## File Map

**Backend (workdir `D:\Shagun CRM\backend`):**
- Create: `alembic/versions/9031_add_inventory_lifecycle.py` — new columns + `event_audit_logs` table
- Modify: `app/models/event_inventory_item.py` — add 4 columns
- Create: `app/models/event_audit_log.py` — new model
- Modify: `app/models/__init__.py` — register `EventAuditLog`
- Modify: `app/schemas/event.py` — `EventInventoryRow`, `ClosureSummary`, `InventoryItemSave`, new `InventoryItemPatch` + `EventAuditRow`
- Modify: `app/services/event_service.py` — `_received_tag`, `_fmt_value`, `log_event_audit`, bundle rewrite, closure rewrite
- Modify: `app/routers/events.py` — PATCH inventory-items, receive-all, return-all, audit GET; audit in `save_inventory_items`, `save_vendors`, `complete_event`
- Modify: `app/routers/inquiries.py` — persist `required_qty` on ingredient upload + audit uploads
- Modify: `tests/test_events.py` — rewrite `test_inventory_derivation_and_edits`
- Create: `tests/test_events_lifecycle.py` — new endpoint/audit/rule tests

**Frontend (workdir `D:\Shagun CRM\frontend`):**
- Modify: `src/types/event.ts` — row/closure/patch/audit types
- Modify: `src/api/events.ts` — 4 new API functions
- Modify: `src/hooks/useEvents.ts` — 4 new hooks
- Modify: `src/pages/events/EventView.tsx` — inventory section rebuild, audit trail, vendor search, kitchen View/Download
- Create: `src/components/events/EventInventoryList.tsx` — shared read-only list
- Modify: `src/pages/kitchen/KitchenDashboard.tsx` + `src/pages/warehouse/WarehouseDashboard.tsx` — add read-only section

**Verification commands**
- Backend: `python -m pytest -v` (run from `backend`). Prereq: `alembic upgrade head` against local dev DB.
- Frontend: `npx tsc -b` then `npm run build`.

---

## Task 1: Migration 9031 — new columns + event_audit_logs

**Files:**
- Create: `backend/alembic/versions/9031_add_inventory_lifecycle.py`

- [ ] **Step 1: Write the migration**

```python
"""add lalit inventory lifecycle (required qty, not received, breakage, transfer event, audit logs)

Revision ID: 9031
Revises: 9030
Create Date: 2026-08-14 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9031"
down_revision: Union[str, None] = "9030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("event_inventory_items", sa.Column("required_qty", sa.Float(), nullable=True))
    op.add_column("event_inventory_items", sa.Column("not_received_count", sa.Float(), nullable=True))
    op.add_column("event_inventory_items", sa.Column("breakage_count", sa.Float(), nullable=True))
    op.add_column("event_inventory_items", sa.Column("transfer_event", sa.String(length=255), nullable=True))

    op.create_table(
        "event_audit_logs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("item_name", sa.String(length=255), nullable=True),
        sa.Column("field_name", sa.String(length=50), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("event_audit_logs")
    op.drop_column("event_inventory_items", "transfer_event")
    op.drop_column("event_inventory_items", "breakage_count")
    op.drop_column("event_inventory_items", "not_received_count")
    op.drop_column("event_inventory_items", "required_qty")
```

- [ ] **Step 2: Apply and verify**

Run (from `backend`):
```
alembic upgrade head
```
Expected: output shows `Running upgrade 9030 -> 9031`. Then:
```
python -c "from alembic.script import ScriptDirectory; from alembic.config import Config; cfg=Config('alembic.ini'); print([h.revision for h in ScriptDirectory.from_config(cfg).get_heads()])"
```
Expected: `['9031']`

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/9031_add_inventory_lifecycle.py
git commit -m "feat(db): inventory lifecycle columns and event audit logs"
```

---

## Task 2: Models — EventInventoryItem columns + EventAuditLog

**Files:**
- Modify: `backend/app/models/event_inventory_item.py`
- Create: `backend/app/models/event_audit_log.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Add columns to EventInventoryItem**

After the `remark` line in `backend/app/models/event_inventory_item.py`, add:

```python
    required_qty: Mapped[float | None] = mapped_column(Float, nullable=True)
    not_received_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    breakage_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    transfer_event: Mapped[str | None] = mapped_column(String(255), nullable=True)
```

- [ ] **Step 2: Create the EventAuditLog model**

Create `backend/app/models/event_audit_log.py`:

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin


class EventAuditLog(UUIDMixin, Base):
    __tablename__ = "event_audit_logs"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    item_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    field_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
```

- [ ] **Step 3: Register in `models/__init__.py`**

Add import `from app.models.event_audit_log import EventAuditLog` after the `EventInventoryItem` import, and add `"EventAuditLog",` to `__all__`.

- [ ] **Step 4: Verify imports**

Run (from `backend`):
```
python -c "import app.models; from app.models import EventAuditLog, EventInventoryItem; print('ok')"
```
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/event_inventory_item.py backend/app/models/event_audit_log.py backend/app/models/__init__.py
git commit -m "feat(models): event inventory lifecycle columns and audit log model"
```

---

## Task 3: Schemas

**Files:**
- Modify: `backend/app/schemas/event.py`

- [ ] **Step 1: Update `EventInventoryRow`**

Replace the existing `EventInventoryRow` (lines 17-27) with:

```python
class EventInventoryRow(BaseModel):
    sr_no: int
    item_name: str
    required_qty: float = 0
    received_qty: float = 0
    not_received_count: int = 0
    received_tag: str = "No"
    transfer_count: float = 0
    returned_qty: float = 0
    breakage_count: float = 0
    transfer_event: str | None = None
    unit: str | None = None
    remark: str | None = None
```

- [ ] **Step 2: Update `ClosureSummary`**

Add two fields to `ClosureSummary` (keep `wastage_qty`):

```python
class ClosureSummary(BaseModel):
    total_items: int = 0
    total_required_qty: float = 0
    total_received_qty: float = 0
    not_received_qty: float = 0
    transferred_qty: float = 0
    returned_thol_qty: float = 0
    wastage_qty: float = 0
    breakage_qty: float = 0
    pending_qty: float = 0
```

- [ ] **Step 3: Update `InventoryItemSave`**

Replace with (adds `required_qty`, `not_received_count`):

```python
class InventoryItemSave(BaseModel):
    item_name: str
    required_qty: float | None = None
    received_qty: float | None = None
    not_received_count: float | None = None
    transfer_count: float | None = None
    returned_qty: float | None = None
    remark: str | None = None
```

- [ ] **Step 4: Add new schemas**

Append after `VendorsSaveRequest`:

```python
class InventoryItemPatch(BaseModel):
    item_name: str
    field: str
    value: float | str | None = None
    remark: str | None = None


class EventAuditRow(BaseModel):
    id: uuid.UUID
    action: str
    entity_type: str
    item_name: str | None = None
    field_name: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    remark: str | None = None
    created_at: datetime
    user_name: str | None = None
```

- [ ] **Step 5: Verify**

Run (from `backend`):
```
python -c "from app.schemas.event import EventInventoryRow, EventAuditRow, InventoryItemPatch; print(EventInventoryRow(sr_no=1, item_name='x'))"
```
Expected: row prints with `received_tag='No'`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/event.py
git commit -m "feat(schemas): inventory lifecycle row, closure and audit schemas"
```

---

## Task 4: Service — bundle, tags, closure, audit helper

**Files:**
- Modify: `backend/app/services/event_service.py`

- [ ] **Step 1: Add imports**

Add to the imports at the top:

```python
from app.models.event_audit_log import EventAuditLog
```

- [ ] **Step 2: Replace `_status` with `_received_tag` and add helpers**

Replace the `_status` function (lines 28-35) with:

```python
def _received_tag(received: float, required: float) -> str:
    if required <= 0 or received <= 0:
        return "No"
    if received >= required:
        return "Yes"
    return "Half"


def _fmt_value(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, float):
        return "%g" % v
    return str(v)


async def log_event_audit(
    db: AsyncSession,
    inquiry_id: uuid.UUID,
    user_id: uuid.UUID,
    action: str,
    entity_type: str,
    item_name: str | None = None,
    field_name: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    remark: str | None = None,
) -> None:
    db.add(EventAuditLog(
        inquiry_id=inquiry_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        item_name=item_name,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        remark=remark,
    ))
```

- [ ] **Step 3: Rewrite the inventory rows loop in `build_event_bundle`**

Replace the `inventory_rows = []` loop body (lines 147-164) with:

```python
    inventory_rows = []
    for key, base in base_map.items():
        ov = overrides.get(key)
        required_qty = ov.required_qty if ov is not None and ov.required_qty is not None else base["required_qty"]
        received_qty = ov.received_qty if ov is not None and ov.received_qty is not None else 0
        transfer_count = ov.transfer_count if ov is not None and ov.transfer_count is not None else 0
        returned_qty = ov.returned_qty if ov is not None and ov.returned_qty is not None else 0
        breakage_count = ov.breakage_count if ov is not None and ov.breakage_count is not None else 0
        not_received_count = ov.not_received_count if ov is not None and ov.not_received_count is not None else 0
        inventory_rows.append({
            "sr_no": base["sr_no"],
            "item_name": base["item_name"],
            "required_qty": required_qty,
            "received_qty": received_qty,
            "not_received_count": int(not_received_count),
            "received_tag": _received_tag(received_qty, required_qty),
            "transfer_count": transfer_count,
            "returned_qty": returned_qty,
            "breakage_count": breakage_count,
            "transfer_event": ov.transfer_event if ov is not None else None,
            "unit": base["unit"],
            "remark": ov.remark if ov is not None else None,
        })
```

- [ ] **Step 4: Rewrite closure computation**

Rename the wastage accumulation line (currently `wastage_qty = sum(...)`) to `movement_wastage = sum(...)`, then replace the `closure` dict (lines 205-213) with:

```python
    total_required = sum(r["required_qty"] for r in inventory_rows)
    total_received = sum(r["received_qty"] for r in inventory_rows)
    breakage_qty = sum(r["breakage_count"] for r in inventory_rows)
    wastage_total = breakage_qty + movement_wastage
    closure = {
        "total_items": len(inventory_rows),
        "total_required_qty": total_required,
        "total_received_qty": total_received,
        "not_received_qty": sum(r["not_received_count"] for r in inventory_rows),
        "transferred_qty": sum(r["transfer_count"] for r in inventory_rows),
        "returned_thol_qty": sum(r["returned_qty"] for r in inventory_rows),
        "wastage_qty": wastage_total,
        "breakage_qty": breakage_qty,
        "pending_qty": max(total_required - total_received - wastage_total, 0),
    }
```

- [ ] **Step 5: Verify**

Run (from `backend`):
```
python -c "from app.services.event_service import _received_tag, _fmt_value; assert _received_tag(100, 100)=='Yes'; assert _received_tag(50, 100)=='Half'; assert _received_tag(0, 100)=='No'; assert _fmt_value(6.0)=='6'; print('ok')"
```
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/event_service.py
git commit -m "feat(service): persisted inventory rows, received tag, lifecycle closure"
```

---

## Task 5: Router — PATCH, bulk actions, audit GET, completion + vendor audit

**Files:**
- Modify: `backend/app/routers/events.py`

- [ ] **Step 1: Update imports**

Change the model import block (after `from app.models.event_photo import EventPhoto`) to add:

```python
from app.models.event_audit_log import EventAuditLog
```

Change the schema import block to add:

```python
    InventoryItemPatch,
    EventAuditRow,
```

Change the service import line to:

```python
from app.services.event_service import (
    build_event_bundle,
    get_base_inventory_map,
    _user_name_map,
    _inquiry_name_map,
    _fmt_value,
    log_event_audit,
)
```

- [ ] **Step 2: Add field constants + PATCH endpoint**

Add right after the `router = APIRouter(...)` line:

```python
PATCHABLE_FIELDS = {"required_qty", "not_received_count", "transfer_count", "returned_qty", "breakage_count", "transfer_event"}
NUMERIC_FIELDS = {"required_qty", "not_received_count", "transfer_count", "returned_qty", "breakage_count"}
```

Add this endpoint after `save_inventory_items` (after line 162):

```python
@router.patch("/{inquiry_id}/inventory-items")
async def patch_inventory_item(
    inquiry_id: uuid.UUID,
    data: InventoryItemPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager", "warehouse")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")
    if data.field not in PATCHABLE_FIELDS:
        raise HTTPException(status_code=400, detail=f"field must be one of: {', '.join(sorted(PATCHABLE_FIELDS))}")

    base_map = await get_base_inventory_map(db, inquiry)
    base = base_map.get(data.item_name.strip().lower())
    if base is None:
        raise HTTPException(status_code=400, detail=f"Item '{data.item_name}' not found in required plan")

    result = await db.execute(
        select(EventInventoryItem).where(
            EventInventoryItem.inquiry_id == inquiry_id,
            EventInventoryItem.item_name == base["item_name"],
        )
    )
    ov = result.scalar_one_or_none()
    if ov is None:
        ov = EventInventoryItem(inquiry_id=inquiry_id, item_name=base["item_name"], required_qty=base["required_qty"])
        db.add(ov)
        await db.flush()

    if data.field in NUMERIC_FIELDS:
        try:
            new_val: float | None = None if data.value is None else float(data.value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"{data.field} must be a number")
        if new_val is not None and new_val < 0:
            raise HTTPException(status_code=400, detail=f"{data.field} cannot be negative")
    else:
        new_val = data.value

    old_str = _fmt_value(getattr(ov, data.field))
    new_str = _fmt_value(new_val)
    if old_str != new_str:
        if data.field == "required_qty" and not (data.remark or "").strip():
            raise HTTPException(status_code=400, detail="Remark is mandatory when changing required qty")
        setattr(ov, data.field, new_val)
        await log_event_audit(
            db, inquiry_id, current_user.id, "edit", "inventory_item",
            item_name=base["item_name"], field_name=data.field,
            old_value=old_str, new_value=new_str,
            remark=(data.remark or "").strip() or None,
        )
        await db.commit()
    return {"ok": True}
```

- [ ] **Step 3: Add receive-all + return-all endpoints**

Add after the PATCH endpoint:

```python
@router.post("/{inquiry_id}/inventory/receive-all")
async def receive_all_inventory(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")
    base_map = await get_base_inventory_map(db, inquiry)
    if not base_map:
        raise HTTPException(status_code=400, detail="No ingredient plan uploaded for this event")

    existing = {
        o.item_name.strip().lower(): o
        for o in (await db.execute(select(EventInventoryItem).where(EventInventoryItem.inquiry_id == inquiry_id))).scalars().all()
    }
    updated = 0
    for key, base in base_map.items():
        ov = existing.get(key)
        if ov is None:
            ov = EventInventoryItem(inquiry_id=inquiry_id, item_name=base["item_name"], required_qty=base["required_qty"])
            db.add(ov)
            existing[key] = ov
        not_received = ov.not_received_count if ov.not_received_count is not None else 0
        target = max(float(base["required_qty"]) - float(not_received), 0)
        old = ov.received_qty if ov.received_qty is not None else 0
        if float(old) != target:
            ov.received_qty = target
            await log_event_audit(
                db, inquiry_id, current_user.id, "edit", "inventory_item",
                item_name=base["item_name"], field_name="received_qty",
                old_value=_fmt_value(old), new_value=_fmt_value(target),
                remark="Received All Inventory",
            )
            updated += 1
    await db.commit()
    return {"ok": True, "updated": updated}


@router.post("/{inquiry_id}/inventory/return-all")
async def return_all_inventory(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operations_manager")),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")
    base_map = await get_base_inventory_map(db, inquiry)
    if not base_map:
        raise HTTPException(status_code=400, detail="No ingredient plan uploaded for this event")

    existing = {
        o.item_name.strip().lower(): o
        for o in (await db.execute(select(EventInventoryItem).where(EventInventoryItem.inquiry_id == inquiry_id))).scalars().all()
    }
    updated = 0
    for key, base in base_map.items():
        ov = existing.get(key)
        if ov is None:
            ov = EventInventoryItem(inquiry_id=inquiry_id, item_name=base["item_name"], required_qty=base["required_qty"])
            db.add(ov)
            existing[key] = ov
        not_received = ov.not_received_count if ov.not_received_count is not None else 0
        transfer = ov.transfer_count if ov.transfer_count is not None else 0
        target = max(float(base["required_qty"]) - float(not_received) - float(transfer), 0)
        old = ov.returned_qty if ov.returned_qty is not None else 0
        if float(old) != target:
            ov.returned_qty = target
            await log_event_audit(
                db, inquiry_id, current_user.id, "edit", "inventory_item",
                item_name=base["item_name"], field_name="returned_qty",
                old_value=_fmt_value(old), new_value=_fmt_value(target),
                remark="All Items Returned to THOL",
            )
            updated += 1
    await db.commit()
    return {"ok": True, "updated": updated}
```

- [ ] **Step 4: Add audit GET endpoint**

Add after the return-all endpoint:

```python
@router.get("/{inquiry_id}/audit", response_model=list[EventAuditRow])
async def get_event_audit(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await get_inquiry_or_404(db, inquiry_id)
    result = await db.execute(
        select(EventAuditLog, User.full_name)
        .join(User, EventAuditLog.user_id == User.id)
        .where(EventAuditLog.inquiry_id == inquiry_id)
        .order_by(EventAuditLog.created_at.desc())
    )
    return [
        EventAuditRow(
            id=log.id, action=log.action, entity_type=log.entity_type,
            item_name=log.item_name, field_name=log.field_name,
            old_value=log.old_value, new_value=log.new_value,
            remark=log.remark, created_at=log.created_at, user_name=name,
        )
        for log, name in result.all()
    ]
```

- [ ] **Step 5: Audit in `complete_event`**

In `complete_event`, insert before `await db.commit()`:

```python
    await log_event_audit(db, inquiry_id, current_user.id, "complete", "event", remark="Event marked as completed")
```

- [ ] **Step 6: Audit in `save_vendors`**

Replace the inner loop of `save_vendors` (lines 176-194) with:

```python
    for row in data.rows:
        result = await db.execute(select(EventVendor).where(EventVendor.id == row.id, EventVendor.inquiry_id == inquiry_id))
        vendor = result.scalar_one_or_none()
        if vendor is None:
            raise HTTPException(status_code=404, detail=f"Vendor {row.id} not found")
        changed = (
            (row.rate is not None and vendor.rate is not None and float(row.rate) != float(vendor.rate))
            or (row.total_cost is not None and vendor.total_cost is not None and float(row.total_cost) != float(vendor.total_cost))
            or (row.payment_status is not None and row.payment_status != vendor.payment_status)
        )
        if changed and not (row.remark or "").strip():
            raise HTTPException(status_code=400, detail=f"Remark is mandatory when changing vendor '{vendor.vendor_name}'")
        changes = []
        if row.rate is not None and (vendor.rate is None or float(row.rate) != float(vendor.rate)):
            changes.append(("rate", _fmt_value(vendor.rate), _fmt_value(row.rate)))
            vendor.rate = row.rate
        if row.total_cost is not None and (vendor.total_cost is None or float(row.total_cost) != float(vendor.total_cost)):
            changes.append(("total_cost", _fmt_value(vendor.total_cost), _fmt_value(row.total_cost)))
            vendor.total_cost = row.total_cost
        if row.payment_status is not None and row.payment_status != vendor.payment_status:
            changes.append(("payment_status", _fmt_value(vendor.payment_status), _fmt_value(row.payment_status)))
            vendor.payment_status = row.payment_status
        vendor.remark = row.remark
        for field_name, old_v, new_v in changes:
            await log_event_audit(
                db, inquiry_id, current_user.id, "edit", "vendor",
                item_name=vendor.vendor_name, field_name=field_name,
                old_value=old_v, new_value=new_v,
                remark=(row.remark or "").strip() or None,
            )
```

- [ ] **Step 7: Verify router imports cleanly**

Run (from `backend`):
```
python -c "import app.routers.events; print('ok')"
```
Expected: `ok`

- [ ] **Step 8: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat(api): inventory patch, receive-all, return-all and audit endpoints"
```

---

## Task 6: Router — audit + new fields in `save_inventory_items`

**Files:**
- Modify: `backend/app/routers/events.py`

- [ ] **Step 1: Replace `save_inventory_items` body**

Replace the whole `save_inventory_items` endpoint (lines 114-162) with:

```python
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

        current_required = ov.required_qty if ov is not None and ov.required_qty is not None else base["required_qty"]
        current_received = ov.received_qty if ov is not None and ov.received_qty is not None else 0
        current_not_received = ov.not_received_count if ov is not None and ov.not_received_count is not None else 0
        current_transfer = ov.transfer_count if ov is not None and ov.transfer_count is not None else 0
        current_returned = ov.returned_qty if ov is not None and ov.returned_qty is not None else 0

        changes = []
        if row.required_qty is not None and float(row.required_qty) != float(current_required):
            changes.append(("required_qty", _fmt_value(current_required), _fmt_value(row.required_qty)))
        if row.received_qty is not None and float(row.received_qty) != float(current_received):
            changes.append(("received_qty", _fmt_value(current_received), _fmt_value(row.received_qty)))
        if row.not_received_count is not None and float(row.not_received_count) != float(current_not_received):
            changes.append(("not_received_count", _fmt_value(current_not_received), _fmt_value(row.not_received_count)))
        if row.transfer_count is not None and float(row.transfer_count) != float(current_transfer):
            changes.append(("transfer_count", _fmt_value(current_transfer), _fmt_value(row.transfer_count)))
        if row.returned_qty is not None and float(row.returned_qty) != float(current_returned):
            changes.append(("returned_qty", _fmt_value(current_returned), _fmt_value(row.returned_qty)))

        if changes and not (row.remark or "").strip():
            raise HTTPException(status_code=400, detail=f"Remark is mandatory when changing '{row.item_name}'")

        if ov is None:
            ov = EventInventoryItem(inquiry_id=inquiry_id, item_name=base["item_name"])
            db.add(ov)
            existing[row.item_name.strip().lower()] = ov
        if row.required_qty is not None:
            ov.required_qty = row.required_qty
        if row.received_qty is not None:
            ov.received_qty = row.received_qty
        if row.not_received_count is not None:
            ov.not_received_count = row.not_received_count
        if row.transfer_count is not None:
            ov.transfer_count = row.transfer_count
        if row.returned_qty is not None:
            ov.returned_qty = row.returned_qty
        ov.remark = row.remark

        for field_name, old_v, new_v in changes:
            await log_event_audit(
                db, inquiry_id, current_user.id, "edit", "inventory_item",
                item_name=base["item_name"], field_name=field_name,
                old_value=old_v, new_value=new_v,
                remark=(row.remark or "").strip() or None,
            )

    await db.commit()
    return {"ok": True}
```

- [ ] **Step 2: Verify**

Run (from `backend`):
```
python -c "import app.routers.events; print('ok')"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat(api): audit and lifecycle fields in inventory save"
```

---

## Task 7: Inquiries router — persist required qty + upload audit

**Files:**
- Modify: `backend/app/routers/inquiries.py`

- [ ] **Step 1: Add imports**

Add to the imports at the top (the file already imports `parse_item_qty_file` on line 23):

```python
from app.models.event_inventory_item import EventInventoryItem
from app.services.event_service import log_event_audit
```

- [ ] **Step 2: Persist `required_qty` on ingredient upload**

In `upload_inquiry_file`, after the `elif file_type == "kitchen_inventory":` block (after line 385), add:

```python
    elif file_type == "ingredient":
        parsed = parse_item_qty_file(file_path, ext)
        existing_items = {
            o.item_name.strip().lower(): o
            for o in (await db.execute(select(EventInventoryItem).where(EventInventoryItem.inquiry_id == inquiry_id))).scalars().all()
        }
        for item_name, qty, unit in parsed:
            key = item_name.strip().lower()
            ov = existing_items.get(key)
            if ov is None:
                ov = EventInventoryItem(inquiry_id=inquiry_id, item_name=item_name.strip(), required_qty=qty)
                db.add(ov)
                existing_items[key] = ov
            else:
                ov.required_qty = qty
```

- [ ] **Step 3: Audit uploads**

After the existing `await db.commit()` / `await db.refresh(inquiry)` (after line 390), add:

```python
    await log_event_audit(db, inquiry_id, current_user.id, "upload", "file",
                          field_name=file_type, new_value=file.filename)
    await db.commit()
```

- [ ] **Step 4: Audit movement-file uploads**

In `upload_inventory_movement_file`, before the final `await db.commit()` (line 479), add:

```python
    await log_event_audit(db, inquiry_id, current_user.id, "upload", "file",
                          field_name=movement_type, new_value=file.filename)
```

- [ ] **Step 5: Verify**

Run (from `backend`):
```
python -c "import app.routers.inquiries; print('ok')"
```
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/inquiries.py
git commit -m "feat(api): persist required qty on ingredient upload and audit file uploads"
```

---

## Task 8: Backend tests — rewrite + new lifecycle suite

**Files:**
- Modify: `backend/tests/test_events.py`
- Create: `backend/tests/test_events_lifecycle.py`

- [ ] **Step 1: Rewrite `test_inventory_derivation_and_edits`**

Replace the whole existing test (lines 76-117) in `backend/tests/test_events.py` with:

```python
async def test_inventory_derivation_and_edits(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    ingredient = csv_upload("ingredient.csv", "Item Name,Qty,Unit\nPaneer,10,kg\nRice,20,kg\n")
    up_resp = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=ingredient)
    assert up_resp.status_code == 200, up_resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert len(detail["inventory"]) == 2
    paneer = detail["inventory"][0]
    assert paneer["item_name"] == "Paneer"
    assert paneer["required_qty"] == 10
    assert paneer["received_qty"] == 0
    assert paneer["received_tag"] == "No"
    assert paneer["not_received_count"] == 0

    # ops field edit does not need a remark
    ok = await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "item_name": "Paneer", "field": "not_received_count", "value": 3
    })
    assert ok.status_code == 200, ok.text

    # required qty edit without remark -> 400
    bad = await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "item_name": "Paneer", "field": "required_qty", "value": 12
    })
    assert bad.status_code == 400

    # required qty edit with remark -> ok
    ok = await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "item_name": "Paneer", "field": "required_qty", "value": 12, "remark": "kitchen revised requirement"
    })
    assert ok.status_code == 200, ok.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    paneer = detail["inventory"][0]
    assert paneer["required_qty"] == 12
    assert paneer["not_received_count"] == 3

    # unknown item -> 400
    bad_item = await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "item_name": "Ghost", "field": "transfer_count", "value": 1
    })
    assert bad_item.status_code == 400

    # negative value -> 400
    neg = await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "item_name": "Paneer", "field": "transfer_count", "value": -1
    })
    assert neg.status_code == 400

    # bad field -> 400
    bad_field = await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "item_name": "Paneer", "field": "nonsense", "value": 1
    })
    assert bad_field.status_code == 400
```

- [ ] **Step 2: Create `backend/tests/test_events_lifecycle.py`**

```python
import uuid
from datetime import date, timedelta

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def login(client, username, password):
    resp = await client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def csv_upload(file_name: str, content: str):
    return {"file": (file_name, content.encode("utf-8"), "text/csv")}


async def create_handover_inquiry(client, token):
    resp = await client.post("/api/inquiries", headers=auth(token), json={
        "client_name": f"Lifecycle {uuid.uuid4().hex[:6]}",
        "client_phone": "9876543210",
        "event_type": "Wedding",
        "event_date": str(date.today() + timedelta(days=5)),
        "pax": 200,
        "venue": "Test Venue",
        "per_plate_rate": 500,
    })
    assert resp.status_code == 201, f"create failed: {resp.status_code} {resp.text}"
    inquiry_id = resp.json()["id"]
    status_resp = await client.patch(f"/api/inquiries/{inquiry_id}/status?new_status=operation_handover", headers=auth(token))
    assert status_resp.status_code == 200, f"status failed: {status_resp.status_code} {status_resp.text}"
    return inquiry_id


async def test_receive_all_and_return_all(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    ingredient = csv_upload("ingredient.csv", "Item Name,Qty,Unit\nPlates,100,pcs\nSpoon,200,pcs\nGlass,150,pcs\n")
    resp = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=ingredient)
    assert resp.status_code == 200, resp.text

    # no ingredient plan -> 400
    other = await create_handover_inquiry(client, token)
    no_plan = await client.post(f"/api/events/{other}/inventory/receive-all", headers=auth(token))
    assert no_plan.status_code == 400

    # enter not-received counts BEFORE the receive-all bulk action
    await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Spoon", "field": "not_received_count", "value": 20})
    await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Glass", "field": "not_received_count", "value": 150})

    recv = await client.post(f"/api/events/{inquiry_id}/inventory/receive-all", headers=auth(token))
    assert recv.status_code == 200, recv.text
    assert recv.json()["updated"] == 3

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    by_name = {r["item_name"]: r for r in detail["inventory"]}
    assert by_name["Plates"]["received_qty"] == 100
    assert by_name["Plates"]["received_tag"] == "Yes"
    assert by_name["Spoon"]["received_qty"] == 180
    assert by_name["Spoon"]["received_tag"] == "Half"
    assert by_name["Glass"]["received_qty"] == 0
    assert by_name["Glass"]["received_tag"] == "No"

    # transfer_count then return-all
    await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Spoon", "field": "transfer_count", "value": 50})
    ret = await client.post(f"/api/events/{inquiry_id}/inventory/return-all", headers=auth(token))
    assert ret.status_code == 200, ret.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    by_name = {r["item_name"]: r for r in detail["inventory"]}
    assert by_name["Spoon"]["returned_qty"] == 130  # 200 - 20 - 50

    closure = detail["closure"]
    assert closure["total_required_qty"] == 450
    assert closure["total_received_qty"] == 280
    assert closure["not_received_qty"] == 170
    assert closure["transferred_qty"] == 50
    assert closure["returned_thol_qty"] == 130
    assert closure["breakage_qty"] == 0
    assert closure["wastage_qty"] == 0
    assert closure["pending_qty"] == 170  # 450 - 280 - 0

    # kitchen cannot run bulk actions
    kitchen_token = await login(client, "kitchen@shaguncatering.com", "kitchen123")
    forbidden = await client.post(f"/api/events/{inquiry_id}/inventory/receive-all", headers=auth(kitchen_token))
    assert forbidden.status_code == 403


async def test_breakage_and_audit_trail(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    ingredient = csv_upload("ingredient.csv", "Item Name,Qty,Unit\nPaneer,10,kg\n")
    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=ingredient)

    await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Paneer", "field": "breakage_count", "value": 2})
    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert detail["inventory"][0]["breakage_count"] == 2
    assert detail["closure"]["breakage_qty"] == 2
    assert detail["closure"]["wastage_qty"] == 2

    # transfer_event is a free-text ops column
    await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Paneer", "field": "transfer_event", "value": "Mehta wedding"})
    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert detail["inventory"][0]["transfer_event"] == "Mehta wedding"

    await client.post(f"/api/events/{inquiry_id}/complete", headers=auth(token))

    # edits locked after completion
    locked = await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Paneer", "field": "breakage_count", "value": 3})
    assert locked.status_code == 400

    # audit trail readable by any role, includes edits, bulk actions, uploads, completion
    audit = (await client.get(f"/api/events/{inquiry_id}/audit", headers=auth(token))).json()
    actions = [(a["action"], a["entity_type"], a["field_name"]) for a in audit]
    assert ("complete", "event", None) in actions
    assert ("edit", "inventory_item", "breakage_count") in actions
    assert ("edit", "inventory_item", "transfer_event") in actions
    assert ("upload", "file", "ingredient") in actions
    assert all(a["user_name"] for a in audit)

    # audit list is scoped per event
    other = await create_handover_inquiry(client, token)
    other_audit = (await client.get(f"/api/events/{other}/audit", headers=auth(token))).json()
    assert len(other_audit) == 0


async def test_vendor_edit_writes_audit(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    vendor = csv_upload("vendor.csv", "Vendor Name,Service Name,Rate,Total Cost,Remark\nABC Catering,Staff,500,15000,staff team\n")
    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=vendor", headers=auth(token), files=vendor)

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    vendor_id = detail["vendors"][0]["id"]

    ok = await client.post(f"/api/events/{inquiry_id}/vendors", headers=auth(token), json={
        "rows": [{"id": vendor_id, "rate": 600, "total_cost": None, "remark": "rate increased"}]
    })
    assert ok.status_code == 200, ok.text

    audit = (await client.get(f"/api/events/{inquiry_id}/audit", headers=auth(token))).json()
    assert ("edit", "vendor", "rate") in [(a["action"], a["entity_type"], a["field_name"]) for a in audit]


async def test_required_qty_persists_after_reupload(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=csv_upload("i1.csv", "Item Name,Qty,Unit\nPaneer,10,kg\n"))
    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=csv_upload("i2.csv", "Item Name,Qty,Unit\nPaneer,14,kg\nRice,5,kg\n"))

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    by_name = {r["item_name"]: r for r in detail["inventory"]}
    assert by_name["Paneer"]["required_qty"] == 14
    assert by_name["Rice"]["required_qty"] == 5
```

- [ ] **Step 3: Run the full backend suite**

Run (from `backend`):
```
python -m pytest -v
```
Expected: all tests pass (previously 44; now includes the 4 new lifecycle tests).

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_events.py backend/tests/test_events_lifecycle.py
git commit -m "test(events): inventory lifecycle, bulk actions, audit trail and locking"
```

---

## Task 9: Frontend types

**Files:**
- Modify: `frontend/src/types/event.ts`

- [ ] **Step 1: Update `EventInventoryRow`**

Replace lines 12-23 with:

```ts
export interface EventInventoryRow {
  sr_no: number
  item_name: string
  required_qty: number
  received_qty: number
  not_received_count: number
  received_tag: string
  transfer_count: number
  returned_qty: number
  breakage_count: number
  transfer_event: string | null
  unit: string | null
  remark: string | null
}
```

- [ ] **Step 2: Update `ClosureSummary`**

Add `breakage_qty` and `pending_qty`:

```ts
export interface ClosureSummary {
  total_items: number
  total_required_qty: number
  total_received_qty: number
  not_received_qty: number
  transferred_qty: number
  returned_thol_qty: number
  wastage_qty: number
  breakage_qty: number
  pending_qty: number
}
```

- [ ] **Step 3: Update `InventoryItemSave`**

Add `required_qty` and `not_received_count`:

```ts
export interface InventoryItemSave {
  item_name: string
  required_qty?: number | null
  received_qty?: number | null
  not_received_count?: number | null
  transfer_count?: number | null
  returned_qty?: number | null
  remark?: string | null
}
```

- [ ] **Step 4: Add new types**

Append at the end of the file:

```ts
export interface InventoryItemPatch {
  item_name: string
  field: string
  value: number | string | null
  remark?: string | null
}

export interface EventAuditRow {
  id: string
  action: string
  entity_type: string
  item_name: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  remark: string | null
  created_at: string
  user_name: string | null
}
```

- [ ] **Step 5: Verify types compile**

Run (from `frontend`):
```
npx tsc -b
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/event.ts
git commit -m "feat(types): inventory lifecycle and audit types"
```

---

## Task 10: Frontend API client

**Files:**
- Modify: `frontend/src/api/events.ts`

- [ ] **Step 1: Update imports + add functions**

Change line 2 to:

```ts
import type { EventListItem, EventDetail, InventoryItemSave, InventoryItemPatch, VendorSave, WarehouseRequestRow, TransferRow, EventAuditRow } from '@/types/event'
```

Append at the end of the file:

```ts
export async function patchInventoryItem(id: string, payload: InventoryItemPatch): Promise<{ ok: boolean }> {
  const response = await client.patch(`/events/${id}/inventory-items`, payload)
  return response.data
}

export async function receiveAllInventory(id: string): Promise<{ ok: boolean; updated: number }> {
  const response = await client.post(`/events/${id}/inventory/receive-all`)
  return response.data
}

export async function returnAllInventory(id: string): Promise<{ ok: boolean; updated: number }> {
  const response = await client.post(`/events/${id}/inventory/return-all`)
  return response.data
}

export async function getEventAudit(id: string): Promise<EventAuditRow[]> {
  const response = await client.get(`/events/${id}/audit`)
  return response.data
}
```

- [ ] **Step 2: Verify types compile**

Run (from `frontend`):
```
npx tsc -b
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/events.ts
git commit -m "feat(api): inventory lifecycle and audit client functions"
```

---

## Task 11: Frontend hooks

**Files:**
- Modify: `frontend/src/hooks/useEvents.ts`

- [ ] **Step 1: Update imports**

Change line 3 to:

```ts
import type { InventoryItemSave, InventoryItemPatch, VendorSave } from '@/types/event'
```

- [ ] **Step 2: Add hooks**

Append at the end of the file:

```ts
export function usePatchInventoryItem(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: InventoryItemPatch) => eventsApi.patchInventoryItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['event-audit', id] })
    },
  })
}

export function useReceiveAllInventory(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => eventsApi.receiveAllInventory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['event-audit', id] })
    },
  })
}

export function useReturnAllInventory(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => eventsApi.returnAllInventory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['event-audit', id] })
    },
  })
}

export function useEventAudit(id: string) {
  return useQuery({
    queryKey: ['event-audit', id],
    queryFn: () => eventsApi.getEventAudit(id),
    enabled: Boolean(id),
  })
}
```

- [ ] **Step 3: Verify types compile**

Run (from `frontend`):
```
npx tsc -b
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useEvents.ts
git commit -m "feat(hooks): inventory lifecycle and audit hooks"
```

---

## Task 12: EventView — inventory section rebuild

**Files:**
- Modify: `frontend/src/pages/events/EventView.tsx`

- [ ] **Step 1: Update imports**

Replace lines 1-28 with:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
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
  Search,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import {
  useEventDetail,
  useSaveVendors,
  useCompleteEvent,
  useCreateWarehouseRequests,
  useIssueWarehouseRequest,
  useReceiveWarehouseRequest,
  useUploadEventPhoto,
  useCreateTransfer,
  useEvents,
  usePatchInventoryItem,
  useReceiveAllInventory,
  useReturnAllInventory,
  useEventAudit,
} from '@/hooks/useEvents'
import { downloadInquiryFile, uploadInquiryFile, viewInquiryFile } from '@/api/inquiries'
import { downloadUploadVersion, getEventPhotoBlob, downloadEventPhoto } from '@/api/events'
import type { EventInventoryRow, EventPhotoRow, EventVendorRow, TransferRow } from '@/types/event'
import { getErrorMessage } from '@/lib/apiError'
import { INQUIRY_STATUSES } from '@/lib/constants'
```

- [ ] **Step 2: Add inline cell components**

Add after the `Section` component definition (after line 52):

```tsx
function NumberCell({ value, disabled, onSave, allowEmpty }: { value: number | null; disabled: boolean; onSave: (v: number | null) => void; allowEmpty?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(String(value ?? ''))
  useEffect(() => { setDraft(String(value ?? '')) }, [value])

  if (disabled || !editing) {
    return (
      <button disabled={disabled} onClick={() => setEditing(true)}
        className="w-20 rounded border border-transparent px-2 py-1 text-left text-xs tabular-nums text-gray-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent">
        {value ?? '—'}
      </button>
    )
  }
  const commit = () => {
    const trimmed = draft.trim()
    setEditing(false)
    if (allowEmpty && trimmed === '') { onSave(null); return }
    const num = Number(trimmed)
    if (!Number.isFinite(num)) return
    if (num === value) return
    onSave(num)
  }
  return (
    <input autoFocus type="number" value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
      className="w-20 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none" />
  )
}

function TextCell({ value, disabled, onSave }: { value: string | null; disabled: boolean; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(value ?? '')
  useEffect(() => { setDraft(value ?? '') }, [value])

  if (disabled || !editing) {
    return (
      <button disabled={disabled} onClick={() => setEditing(true)}
        className="w-28 rounded border border-transparent px-2 py-1 text-left text-xs text-gray-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent">
        {value ?? '—'}
      </button>
    )
  }
  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed === (value ?? '')) return
    onSave(trimmed === '' ? null : trimmed)
  }
  return (
    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
      className="w-28 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none" />
  )
}

function RequiredQtyCell({ value, disabled, onSave }: { value: number; disabled: boolean; onSave: (v: number, remark: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [remark, setRemark] = useState('')
  useEffect(() => { setDraft(String(value)) }, [value])

  if (disabled || !editing) {
    return (
      <button disabled={disabled} onClick={() => setEditing(true)}
        className="w-20 rounded border border-transparent px-2 py-1 text-left text-xs tabular-nums text-gray-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent">
        {value}
      </button>
    )
  }
  const commit = () => {
    const num = Number(draft)
    if (!Number.isFinite(num)) return
    if (num === value && !remark.trim()) { setEditing(false); return }
    if (!remark.trim()) { toast.error('Remark is mandatory when changing required qty'); return }
    setEditing(false)
    setRemark('')
    onSave(num, remark.trim())
  }
  return (
    <div className="flex items-center gap-1">
      <input autoFocus type="number" value={draft} onChange={(e) => setDraft(e.target.value)}
        className="w-16 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:outline-none" />
      <input placeholder="Remark (required)" value={remark} onChange={(e) => setRemark(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
        className="w-32 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:outline-none" />
      <button onClick={commit} className="rounded bg-maroon px-2 py-1 text-[10px] font-bold text-white">Save</button>
    </div>
  )
}
```

- [ ] **Step 3: Swap hooks and state**

Inside `EventView`, replace the hook block (lines 95-103) with:

```tsx
  const { data, isLoading, refetch } = useEventDetail(id)
  const patchItem = usePatchInventoryItem(id)
  const receiveAll = useReceiveAllInventory(id)
  const returnAll = useReturnAllInventory(id)
  const { data: audit } = useEventAudit(id)
  const saveVendors = useSaveVendors(id)
  const complete = useCompleteEvent(id)
  const createRequests = useCreateWarehouseRequests(id)
  const issueRequest = useIssueWarehouseRequest(id)
  const receiveRequest = useReceiveWarehouseRequest(id)
  const uploadPhoto = useUploadEventPhoto(id)
  const createTransfer = useCreateTransfer(id)
  const { data: allEvents } = useEvents()
```

Remove the `useSaveInventoryItems` hook usage (drop the import already done in Step 1).

Replace the state block (lines 105-129) with:

```tsx
  const [transferForm, setTransferForm] = useState({ item_name: '', quantity: 0, unit: '', to_inquiry_id: '' })
  const [inventorySearch, setInventorySearch] = useState('')
  const [vendorSearch, setVendorSearch] = useState('')

  const canEdit = !data?.is_completed && EDITABLE_ROLES.includes(role)
  const canComplete = !data?.is_completed && (role === 'operations_manager' || role === 'admin')

  const [vendorRows, setVendorRows] = useState<EventVendorRow[]>([])
  const [savedVendors, setSavedVendors] = useState<EventVendorRow[]>([])

  useEffect(() => {
    if (data) {
      setVendorRows(data.vendors)
      setSavedVendors(JSON.parse(JSON.stringify(data.vendors)))
    }
  }, [data])

  const updateVendor = (vid: string, patch: Partial<EventVendorRow>) => {
    setVendorRows((prev) => prev.map((v) => (v.id === vid ? { ...v, ...patch } : v)))
  }
```

- [ ] **Step 4: Replace `saveInventory` with save helpers**

Replace `saveInventory` (lines 142-166) with:

```tsx
  const saveField = (row: EventInventoryRow, field: string, value: number | string | null, remark?: string) => {
    patchItem.mutate({ item_name: row.item_name, field, value, remark: remark ?? null }, {
      onSuccess: () => toast.success('Saved'),
      onError: (err) => toast.error(getErrorMessage(err, 'Save failed')),
    })
  }

  const handleIngredientUpload = async (file?: File) => {
    if (!file) return
    try {
      await uploadInquiryFile(id, 'ingredient', file)
      toast.success('Ingredient excel uploaded')
      refetch()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'))
    }
  }

  const handleReceiveAll = () => {
    if (!window.confirm('Mark all inventory items as received? Items with a Not Received count are adjusted automatically.')) return
    receiveAll.mutate(undefined, {
      onSuccess: () => toast.success('All inventory marked as received'),
      onError: (err) => toast.error(getErrorMessage(err, 'Action failed')),
    })
  }

  const handleReturnAll = () => {
    if (!window.confirm('Mark all items as returned to THOL? Returned Qty = Required - Not Received - Transferred.')) return
    returnAll.mutate(undefined, {
      onSuccess: () => toast.success('All items marked as returned to THOL'),
      onError: (err) => toast.error(getErrorMessage(err, 'Action failed')),
    })
  }
```

- [ ] **Step 5: Remove the stale `invCols` line**

Delete the line `const invCols = ['Sr No', ...]` (line 238).

- [ ] **Step 6: Replace the Inventory List section**

Replace the whole `{/* 3. Inventory List */}` Section block (lines 316-390) with:

```tsx
      {/* 3. Inventory List */}
      <Section title="Inventory List">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              placeholder="Search items…"
              className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          {OPERATIONS_ROLES.includes(role) && !data.is_completed && (
            <>
              <button onClick={handleReceiveAll} disabled={receiveAll.isPending}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {receiveAll.isPending ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={12} />} Received All Inventory
              </button>
              <button onClick={handleReturnAll} disabled={returnAll.isPending}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {returnAll.isPending ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />} All Items Returned to THOL
              </button>
            </>
          )}
          {data.ingredient_file_name && (
            <button onClick={() => viewInquiryFile(id, 'ingredient')}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <FileText size={12} /> View Excel
            </button>
          )}
          {data.ingredient_file_name && (
            <button onClick={() => downloadInquiryFile(id, 'ingredient', data.ingredient_file_name)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <Download size={12} /> Download Excel
            </button>
          )}
          {KITCHEN_UPLOAD_ROLES.includes(role) && !data.is_completed && (
            <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
              <Upload size={12} /> Upload Excel
              <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => { handleIngredientUpload(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Sr No', 'Item Name', 'Required Qty', 'Received Qty', 'Not Received Item Count', 'Received Status', 'Transfer Item Count', 'Transfer Event Name', 'Returned to THOL Qty', 'Breakage / Missing', 'Remark'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.inventory.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-xs text-gray-400">No inventory yet — upload the kitchen's Ingredient Excel to populate Required Qty.</td></tr>
              ) : data.inventory
                .filter((row) => row.item_name.toLowerCase().includes(inventorySearch.toLowerCase()))
                .map((row) => (
                  <tr key={row.item_name} className="border-b border-gray-50">
                    <td className="px-3 py-2.5 text-xs text-gray-500">{row.sr_no}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{row.item_name}</td>
                    <td className="px-3 py-2.5">
                      <RequiredQtyCell value={row.required_qty} disabled={!canEdit}
                        onSave={(v, remark) => saveField(row, 'required_qty', v, remark)} />
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold tabular-nums text-gray-700">{row.received_qty} {row.unit ?? ''}</td>
                    <td className="px-3 py-2.5">
                      <NumberCell value={row.not_received_count} disabled={!canEdit}
                        onSave={(v) => saveField(row, 'not_received_count', v)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        row.received_tag === 'Yes' ? 'bg-emerald-100 text-emerald-700'
                        : row.received_tag === 'Half' ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>{row.received_tag}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <NumberCell value={row.transfer_count} disabled={!canEdit}
                        onSave={(v) => saveField(row, 'transfer_count', v)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <TextCell value={row.transfer_event} disabled={!canEdit}
                        onSave={(v) => saveField(row, 'transfer_event', v)} />
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold tabular-nums text-gray-700">{row.returned_qty}</td>
                    <td className="px-3 py-2.5">
                      <NumberCell value={row.breakage_count} disabled={!canEdit}
                        onSave={(v) => saveField(row, 'breakage_count', v)} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{row.remark ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>
```

Note: `remark` is a `Text` field, not one of `PATCHABLE_FIELDS`, so it renders read-only. The last edit made to any field carries its remark into the row.

- [ ] **Step 7: Verify types compile**

Run (from `frontend`):
```
npx tsc -b
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/events/EventView.tsx
git commit -m "feat(events): lifecycle inventory table with bulk actions and search"
```

---

## Task 13: EventView — audit trail, vendor search, kitchen View/Download

**Files:**
- Modify: `frontend/src/pages/events/EventView.tsx`

- [ ] **Step 1: Add vendor search box**

In the Vendor Details section, right after `<Section title="Vendor Details">` (line 393), add:

```tsx
        <div className="relative mb-3 min-w-[220px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
            placeholder="Search vendors…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
```

Change the vendor table body map (line 406) from `vendorRows.map((v, i) => (` to:

```tsx
              ) : vendorRows.filter((v) => v.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase())).map((v, i) => (
```

- [ ] **Step 2: Add kitchen inventory View/Download buttons**

In the Kitchen Inventory section, replace the upload-label block (lines 495-500) with:

```tsx
        <div className="mt-4 flex flex-wrap gap-2">
          {data.kitchen_inventory_file_name && (
            <button onClick={() => viewInquiryFile(id, 'kitchen_inventory')}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <EyeIcon size={12} /> View Excel
            </button>
          )}
          {data.kitchen_inventory_file_name && (
            <button onClick={() => downloadInquiryFile(id, 'kitchen_inventory', data.kitchen_inventory_file_name)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <Download size={12} /> Download Excel
            </button>
          )}
          {KITCHEN_UPLOAD_ROLES.includes(role) && !data.is_completed && (
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
              <Upload size={12} /> Upload Kitchen Inventory Excel
              <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => { handleUpload('kitchen_inventory', e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )}
        </div>
```

Add `Eye as EyeIcon` to the lucide import in EventView (Step 1 already added `Search`; add `Eye as EyeIcon`).

- [ ] **Step 3: Update closure summary to use lifecycle totals**

In the Closure Summary section, replace the grid array (lines 723-730) with:

```tsx
          {[
            ['Total Items', data.closure.total_items],
            ['Total Required Qty', data.closure.total_required_qty],
            ['Total Received Qty', data.closure.total_received_qty],
            ['Not Received Qty', data.closure.not_received_qty],
            ['Transferred Qty', data.closure.transferred_qty],
            ['Returned to THOL Qty', data.closure.returned_thol_qty],
            ['Breakage / Wastage', data.closure.wastage_qty],
            ['Pending Qty', data.closure.pending_qty],
          ].map(([label, value]) => (
```

- [ ] **Step 4: Add the Audit Trail section**

Insert a new Section after the Closure Summary section (after line 738):

```tsx
      {/* 6b. Audit Trail */}
      <Section title="Audit Trail">
        {!audit || audit.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Time', 'User', 'Action', 'Type', 'Item', 'Field', 'From', 'To', 'Remark'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50">
                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-gray-600">{a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] font-medium text-gray-900">{a.user_name ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        a.action === 'upload' ? 'bg-blue-100 text-blue-700'
                        : a.action === 'complete' ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-700'
                      }`}>{a.action}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">{a.entity_type}</td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">{a.item_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">{a.field_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">{a.old_value ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] font-medium text-gray-900">{a.new_value ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">{a.remark ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
```

- [ ] **Step 5: Verify types compile**

Run (from `frontend`):
```
npx tsc -b
```
Expected: no errors.

- [ ] **Step 6: Build**

Run (from `frontend`):
```
npm run build
```
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/events/EventView.tsx
git commit -m "feat(events): audit trail, vendor search and kitchen file buttons"
```

---

## Task 14: Kitchen + Warehouse dashboards — read-only event inventory

**Files:**
- Create: `frontend/src/components/events/EventInventoryList.tsx`
- Modify: `frontend/src/pages/kitchen/KitchenDashboard.tsx`
- Modify: `frontend/src/pages/warehouse/WarehouseDashboard.tsx`

- [ ] **Step 1: Create the shared component**

```tsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Package, Eye } from 'lucide-react'
import { useEvents, useEventDetail } from '@/hooks/useEvents'
import { useNavigate } from 'react-router-dom'

function EventInventoryTable({ eventId }: { eventId: string }) {
  const { data } = useEventDetail(eventId)
  if (!data) return <p className="px-4 py-4 text-center text-[11px] text-gray-400">Loading…</p>
  if (data.inventory.length === 0) return <p className="px-4 py-4 text-center text-[11px] text-gray-400">No inventory yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {['Item', 'Required', 'Received', 'Not Received', 'Status'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.inventory.map((r) => (
            <tr key={r.item_name} className="border-b border-gray-50">
              <td className="px-3 py-2 text-[11px] font-medium text-gray-900">{r.item_name}</td>
              <td className="px-3 py-2 text-[11px] tabular-nums text-gray-700">{r.required_qty} {r.unit ?? ''}</td>
              <td className="px-3 py-2 text-[11px] tabular-nums text-gray-700">{r.received_qty}</td>
              <td className="px-3 py-2 text-[11px] tabular-nums text-gray-700">{r.not_received_count}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  r.received_tag === 'Yes' ? 'bg-emerald-100 text-emerald-700'
                  : r.received_tag === 'Half' ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
                }`}>{r.received_tag}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function EventInventoryList() {
  const navigate = useNavigate()
  const { data: events, isLoading } = useEvents()
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.45 }}
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Package size={14} className="text-emerald-500" /> Event Inventory <span className="text-[10px] font-medium text-gray-400">(view only)</span>
        </h3>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{events?.length ?? 0} events</span>
      </div>
      {isLoading ? (
        <p className="py-6 text-center text-xs text-gray-400">Loading events…</p>
      ) : !events || events.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">No handover events yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => {
            const open = openId === ev.id
            return (
              <div key={ev.id} className="rounded-lg border border-gray-100">
                <button
                  onClick={() => setOpenId(open ? null : ev.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                >
                  {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                  <span className="flex-1 text-xs font-semibold text-gray-900">{ev.client_name}</span>
                  <span className="text-[10px] text-gray-400">{ev.event_type} · {ev.event_date ?? 'no date'}</span>
                  {ev.is_completed && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Done</span>}
                  <Eye size={13} className="text-gray-300 hover:text-blue-500" />
                </button>
                {open && <div className="border-t border-gray-100"><EventInventoryTable eventId={ev.id} /></div>}
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
```

- [ ] **Step 2: Add to KitchenDashboard**

Add import after the lucide import block:

```tsx
import EventInventoryList from '@/components/events/EventInventoryList'
```

Add `<EventInventoryList />` just before the closing `</div>` (after the Semi-Finished Items block, line 192).

- [ ] **Step 3: Add to WarehouseDashboard**

Add the same import and `<EventInventoryList />` just before the closing `</div>` (after the Recent Activity block, line 192).

- [ ] **Step 4: Verify types compile + build**

Run (from `frontend`):
```
npx tsc -b
npm run build
```
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/events/EventInventoryList.tsx frontend/src/pages/kitchen/KitchenDashboard.tsx frontend/src/pages/warehouse/WarehouseDashboard.tsx
git commit -m "feat(dashboards): read-only event inventory for kitchen and warehouse"
```

---

## Task 15: Full verification

- [ ] **Step 1: Backend suite**

Run (from `backend`):
```
python -m pytest -v
```
Expected: all tests pass.

- [ ] **Step 2: Frontend typecheck + build**

Run (from `frontend`):
```
npx tsc -b
npm run build
```
Expected: both succeed.

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A
git status
```
If anything uncommitted remains, commit with an appropriate conventional message.

---

## Task 16: Deploy to Railway

- [ ] **Step 1: Push**

```bash
git push origin master
```
Expected: remote updated.

- [ ] **Step 2: Deploy backend**

From `backend`:
```
railway up --detach -y -m "lalit inventory lifecycle"
```
Expected: deploy triggered (auto-runs `alembic upgrade head` via entrypoint).

- [ ] **Step 3: Deploy frontend**

From `frontend`:
```
railway up --detach -y -m "lalit inventory lifecycle"
```
Expected: deploy triggered. If Railway flakes with "Failed to snapshot repository", retry the same command once.

- [ ] **Step 4: Verify endpoints**

Check against `https://revly-backend-production-64af.up.railway.app`:
- `GET /api/events/<id>/audit` with an authenticated admin token → 200 JSON list
- `PATCH /api/events/<id>/inventory-items` with a kitchen token → 403

---

## Self-Review Checklist

- Spec coverage: EventView inventory columns (Task 12/13), Received All / Returned to THOL (Task 5), audit trail (Tasks 5-7 + 13), Chef/Store view-only inventory (Task 14), completion locking (Tasks 5-6), required-qty remark rule (Task 5 PATCH), ops columns no-remark (Task 5 PATCH), vendor audit + search/minimize (Tasks 5 + 13).
- Type consistency: `received_tag` used everywhere `received_status` was; `breakage_count`, `transfer_event`, `pending_qty`, `breakage_qty` names match between schemas (Task 3), types (Task 9), bundle (Task 4) and UI (Tasks 12-13). `InventoryItemPatch` field name `item_name`/`field`/`value`/`remark` matches PATCH body used in tests (Task 8).
- Placeholder scan: all steps contain concrete code or exact commands.
