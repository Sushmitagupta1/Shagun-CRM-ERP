# Lalit Bhai Operations DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Operations DB feature set for Lalit Bhai — real Today's Schedule, an Event sidebar page, full Excel preview, per-version inventory upload history, and a hierarchical Event View page (Event Details → Menu → Inventory List → Vendor Details → Kitchen Inventory → Closure Summary → Mark Completed) that locks all editing once completed.

**Architecture:** Backend gets 4 new tables + 2 new columns (`inquiry.is_completed`, `completed_at`), a new `events` router that derives the Event View bundle from the Ingredient Excel + `InventoryMovement` rows + editable override rows, version history for inventory movement uploads, and two new upload file types (`vendor`, `kitchen_inventory`). Frontend gets new `/events` and `/events/:id` pages, a sidebar item, an `events` API/hooks/type layer, and an updated Operations Dashboard. Excel preview caps are removed server-side.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + pytest (backend); React + Vite + TanStack Query + TypeScript + Tailwind (frontend).

**Spec:** `docs/superpowers/specs/2026-08-13-lalit-operations-db-design.md`

---

### Task 1: Alembic migration — new tables + inquiry columns

**Files:**
- Create: `backend/alembic/versions/9029_add_operations_db.py`
- Modify: `backend/alembic/env.py` (no change needed — models imported via `app.models`)

- [x] **Step 1: Create the migration file**

Create `backend/alembic/versions/9029_add_operations_db.py`:

```python
"""add operations db tables (inventory versions, event inventory, vendors, kitchen inventory)

Revision ID: 9029
Revises: 9028
Create Date: 2026-08-13 09:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9029"
down_revision: Union[str, None] = "9028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inquiries", sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("inquiries", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("inquiries", sa.Column("vendor_file_name", sa.String(length=255), nullable=True))
    op.add_column("inquiries", sa.Column("vendor_file_path", sa.String(length=512), nullable=True))
    op.add_column("inquiries", sa.Column("kitchen_inventory_file_name", sa.String(length=255), nullable=True))
    op.add_column("inquiries", sa.Column("kitchen_inventory_file_path", sa.String(length=512), nullable=True))

    op.create_table(
        "inventory_file_versions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("movement_type", sa.String(length=50), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("inquiry_id", "movement_type", "version_no", name="uq_inventory_file_version"),
    )

    op.create_table(
        "event_inventory_items",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_name", sa.String(length=255), nullable=False),
        sa.Column("received_qty", sa.Float(), nullable=True),
        sa.Column("transfer_count", sa.Float(), nullable=True),
        sa.Column("returned_qty", sa.Float(), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("inquiry_id", "item_name", name="uq_event_inventory_item"),
    )

    op.create_table(
        "event_vendors",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("vendor_name", sa.String(length=255), nullable=False),
        sa.Column("service_name", sa.String(length=255), nullable=True),
        sa.Column("rate", sa.Numeric(12, 2), nullable=True),
        sa.Column("total_cost", sa.Numeric(12, 2), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "kitchen_inventory_items",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_name", sa.String(length=255), nullable=False),
        sa.Column("prepared_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("used_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("remaining_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("kitchen_inventory_items")
    op.drop_table("event_vendors")
    op.drop_table("event_inventory_items")
    op.drop_table("inventory_file_versions")
    op.drop_column("inquiries", "kitchen_inventory_file_path")
    op.drop_column("inquiries", "kitchen_inventory_file_name")
    op.drop_column("inquiries", "vendor_file_path")
    op.drop_column("inquiries", "vendor_file_name")
    op.drop_column("inquiries", "completed_at")
    op.drop_column("inquiries", "is_completed")
```

- [x] **Step 2: Run the migration**

Run: `cd backend && python -m alembic upgrade head`
Expected: applies migration 9029; `python -m alembic heads` shows `9029 (head)`.

- [x] **Step 3: Commit**

```bash
git add backend/alembic/versions/9029_add_operations_db.py
git commit -m "feat(db): add operations db tables (inventory versions, vendors, kitchen inventory)"
```

---

### Task 2: Models — new tables + Inquiry fields

**Files:**
- Create: `backend/app/models/inventory_file_version.py`
- Create: `backend/app/models/event_inventory_item.py`
- Create: `backend/app/models/event_vendor.py`
- Create: `backend/app/models/kitchen_inventory_item.py`
- Modify: `backend/app/models/inquiry.py`
- Modify: `backend/app/models/__init__.py`

- [x] **Step 1: Write the four new model files**

Create `backend/app/models/inventory_file_version.py`:

```python
import uuid
from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class InventoryFileVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "inventory_file_versions"
    __table_args__ = (UniqueConstraint("inquiry_id", "movement_type", "version_no", name="uq_inventory_file_version"),)

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    movement_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
```

Create `backend/app/models/event_inventory_item.py`:

```python
import uuid
from sqlalchemy import String, Float, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class EventInventoryItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "event_inventory_items"
    __table_args__ = (UniqueConstraint("inquiry_id", "item_name", name="uq_event_inventory_item"),)

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    received_qty: Mapped[float | None] = mapped_column(Float, nullable=True)
    transfer_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    returned_qty: Mapped[float | None] = mapped_column(Float, nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
```

Create `backend/app/models/event_vendor.py`:

```python
import uuid
from decimal import Decimal
from sqlalchemy import String, Text, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class EventVendor(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "event_vendors"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    service_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    total_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
```

Create `backend/app/models/kitchen_inventory_item.py`:

```python
import uuid
from sqlalchemy import String, Float, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class KitchenInventoryItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "kitchen_inventory_items"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    prepared_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    used_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    remaining_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [x] **Step 2: Add fields to Inquiry model**

In `backend/app/models/inquiry.py`, add after `call_recording_file_path` (line 83):

```python
    vendor_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vendor_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    kitchen_inventory_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    kitchen_inventory_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

`datetime` and `Boolean` are already imported in that file.

- [x] **Step 3: Register models in `backend/app/models/__init__.py`**

Add imports and `__all__` entries:

```python
from app.models.inventory_file_version import InventoryFileVersion
from app.models.event_inventory_item import EventInventoryItem
from app.models.event_vendor import EventVendor
from app.models.kitchen_inventory_item import KitchenInventoryItem
```

Add to `__all__`: `"InventoryFileVersion"`, `"EventInventoryItem"`, `"EventVendor"`, `"KitchenInventoryItem"`.

- [x] **Step 4: Verify imports work**

Run: `cd backend && python -c "from app.models import InventoryFileVersion, EventInventoryItem, EventVendor, KitchenInventoryItem; print('ok')"`
Expected: prints `ok`.

- [x] **Step 5: Commit**

```bash
git add backend/app/models/
git commit -m "feat(models): add inventory versions, event inventory, vendors, kitchen inventory"
```

---

### Task 3: Shared file parsers (preview without caps + vendor/kitchen parsing)

**Files:**
- Create: `backend/app/services/file_parsers.py`
- Modify: `backend/app/routers/inquiries.py` (replace local `read_file_preview` with import)

- [x] **Step 1: Write `backend/app/services/file_parsers.py`**

```python
import csv
from openpyxl import load_workbook

ITEM_HEADER_WORDS = {"item", "item name", "item_name", "itemname", "product", "material", "ingredient", "name", "description"}


def read_file_rows(file_path: str, ext: str) -> list[list[str]]:
    rows: list[list[str]] = []
    if ext == ".csv":
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for raw in reader:
                row = ["" if c is None else str(c).strip() for c in raw]
                if any(row):
                    rows.append(row)
    else:
        wb = load_workbook(file_path, data_only=True, read_only=True)
        try:
            ws = wb.active
            for raw in ws.iter_rows(values_only=True):
                row = ["" if c is None else (c if isinstance(c, (int, float)) else str(c).strip()) for c in raw]
                if any(row):
                    rows.append(row)
        finally:
            wb.close()
    return rows


def read_file_preview(file_path: str, ext: str) -> list[list]:
    """Read the complete file — no row or column caps."""
    if ext == ".csv":
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return [["" if c is None else str(c).strip() for c in raw] for raw in csv.reader(f) if any(raw)]
    wb = load_workbook(file_path, data_only=True, read_only=True)
    try:
        ws = wb.active
        return [
            ["" if c is None else (c if isinstance(c, (int, float)) else str(c).strip()) for c in raw]
            for raw in ws.iter_rows(values_only=True)
            if any(raw)
        ]
    finally:
        wb.close()


def parse_item_qty_file(file_path: str, ext: str) -> list[tuple[str, float, str | None]]:
    rows: list[tuple[str, float, str | None]] = []
    for row in read_file_rows(file_path, ext):
        item = row[0] if len(row) > 0 else ""
        if not item or item.lower() in ITEM_HEADER_WORDS:
            continue
        try:
            qty = float((row[1] if len(row) > 1 else "").replace(",", "")) if len(row) > 1 and row[1] else 0.0
        except (ValueError, TypeError):
            qty = 0.0
        if qty <= 0:
            continue
        unit = row[2] if len(row) > 2 and row[2] else None
        rows.append((item, qty, unit))
    return rows


def _to_float(value) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(str(value).replace(",", "").replace("₹", "").strip())
    except (ValueError, TypeError):
        return None


def _find_col(headers: list[str], keywords: set[str]) -> int | None:
    for i, h in enumerate(headers):
        if h and h.lower().strip() in keywords:
            return i
    return None


def parse_vendor_file(file_path: str, ext: str) -> list[dict]:
    rows = read_file_rows(file_path, ext)
    if not rows:
        return []
    headers = rows[0]
    name_col = _find_col(headers, {"vendor", "vendor name", "vendor_name", "supplier", "supplier name"})
    service_col = _find_col(headers, {"service", "service name", "service_name", "service type"})
    rate_col = _find_col(headers, {"rate", "price", "rate (rs)", "rate (inr)"})
    cost_col = _find_col(headers, {"total cost", "total", "total_cost", "cost", "amount"})
    remark_col = _find_col(headers, {"remark", "remarks", "note", "notes", "comments"})

    result = []
    for row in rows[1:]:
        def cell(i):
            return row[i] if i is not None and i < len(row) else ""
        vendor_name = str(cell(name_col)).strip() if name_col is not None else ""
        if not vendor_name:
            continue
        result.append({
            "vendor_name": vendor_name,
            "service_name": str(cell(service_col)).strip() or None if service_col is not None else None,
            "rate": _to_float(cell(rate_col)) if rate_col is not None else None,
            "total_cost": _to_float(cell(cost_col)) if cost_col is not None else None,
            "remark": str(cell(remark_col)).strip() or None if remark_col is not None else None,
        })
    return result


def parse_kitchen_inventory_file(file_path: str, ext: str) -> list[dict]:
    rows = read_file_rows(file_path, ext)
    if not rows:
        return []
    headers = rows[0]
    item_col = _find_col(headers, {"item", "item name", "item_name", "product", "dish", "preparation", "name"})
    prepared_col = _find_col(headers, {"prepared qty", "prepared", "prepared_qty", "qty prepared", "quantity prepared"})
    unit_col = _find_col(headers, {"unit", "uom"})
    used_col = _find_col(headers, {"used qty", "used", "used_qty", "qty used", "consumed"})
    remaining_col = _find_col(headers, {"remaining qty", "remaining", "remaining_qty", "qty remaining", "left"})
    remark_col = _find_col(headers, {"remark", "remarks", "note", "notes", "comments"})

    result = []
    for row in rows[1:]:
        def cell(i):
            return row[i] if i is not None and i < len(row) else ""
        item_name = str(cell(item_col)).strip() if item_col is not None else ""
        if not item_name:
            continue
        result.append({
            "item_name": item_name,
            "prepared_qty": _to_float(cell(prepared_col)) or 0 if prepared_col is not None else 0,
            "unit": str(cell(unit_col)).strip() or None if unit_col is not None else None,
            "used_qty": _to_float(cell(used_col)) or 0 if used_col is not None else 0,
            "remaining_qty": _to_float(cell(remaining_col)) or 0 if remaining_col is not None else 0,
            "remark": str(cell(remark_col)).strip() or None if remark_col is not None else None,
        })
    return result
```

- [x] **Step 2: Replace `read_file_preview` in `inquiries.py` with an import**

In `backend/app/routers/inquiries.py`:
- Delete the `MAX_PREVIEW_ROWS = 200`, `MAX_PREVIEW_COLS = 12` constants (lines 469-470) and the whole `read_file_preview` function (lines 473-498).
- Delete `parse_movement_file` (lines 376-416) and the `INVENTORY_HEADER_WORDS` constant (line 373).
- Add at the top with the other imports:

```python
from app.services.file_parsers import read_file_preview, parse_item_qty_file
```

- In `upload_inventory_movement_file` (line ~446), replace `rows = parse_movement_file(file_path, ext)` with `rows = parse_item_qty_file(file_path, ext)`.

- [x] **Step 3: Verify existing preview + upload still import**

Run: `cd backend && python -c "from app.routers.inquiries import read_file_preview, parse_item_qty_file; print('ok')"`
Expected: prints `ok`.

- [x] **Step 4: Commit**

```bash
git add backend/app/services/file_parsers.py backend/app/routers/inquiries.py
git commit -m "feat(parsers): full-file preview, vendor and kitchen inventory excel parsers"
```

---

### Task 4: Extend inquiries router — new file types, version history, completion lock

**Files:**
- Modify: `backend/app/routers/inquiries.py`

- [x] **Step 1: Extend `ALLOWED_ROLES` with vendor + kitchen_inventory**

Replace the `ALLOWED_ROLES` dict (lines 296-305) with:

```python
ALLOWED_ROLES = {
    "menu": {"admin", "menu_planner"},
    "presentation": {"admin", "presentation_exec"},
    "ingredient": {"admin", "kitchen"},
    "inventory": {"admin", "operations_manager", "warehouse"},
    "returned": {"admin", "operations_manager", "warehouse"},
    "transferred": {"admin", "operations_manager", "warehouse"},
    "wastage": {"admin", "operations_manager", "warehouse"},
    "vendor": {"admin", "operations_manager", "warehouse"},
    "kitchen_inventory": {"admin", "kitchen"},
    "call_recording": {"admin", "sales_head", "presentation_exec"},
}
```

- [x] **Step 2: Add vendor/kitchen parsing to `upload_inquiry_file`**

In `upload_inquiry_file`, immediately after `await db.commit()` (line 347) and before the `if file_type in ("menu", "presentation"):` block, insert:

```python
    if file_type == "vendor":
        ext = os.path.splitext(file.filename or "")[1].lower()
        parsed = parse_vendor_file(file_path, ext)
        old = await db.execute(select(EventVendor).where(EventVendor.inquiry_id == inquiry_id))
        for v in old.scalars().all():
            await db.delete(v)
        for r in parsed:
            db.add(EventVendor(
                inquiry_id=inquiry_id,
                vendor_name=r["vendor_name"],
                service_name=r["service_name"],
                rate=r["rate"],
                total_cost=r["total_cost"],
                remark=r["remark"],
            ))
        await db.commit()
    elif file_type == "kitchen_inventory":
        ext = os.path.splitext(file.filename or "")[1].lower()
        parsed = parse_kitchen_inventory_file(file_path, ext)
        old = await db.execute(select(KitchenInventoryItem).where(KitchenInventoryItem.inquiry_id == inquiry_id))
        for k in old.scalars().all():
            await db.delete(k)
        for r in parsed:
            db.add(KitchenInventoryItem(
                inquiry_id=inquiry_id,
                item_name=r["item_name"],
                prepared_qty=r["prepared_qty"],
                unit=r["unit"],
                used_qty=r["used_qty"],
                remaining_qty=r["remaining_qty"],
                remark=r["remark"],
            ))
        await db.commit()
```

Add imports at the top of the file:

```python
from app.models.event_vendor import EventVendor
from app.models.kitchen_inventory_item import KitchenInventoryItem
from app.models.inventory_file_version import InventoryFileVersion
from app.services.file_parsers import read_file_preview, parse_item_qty_file, parse_vendor_file, parse_kitchen_inventory_file
```

- [x] **Step 3: Block uploads when event is completed**

At the top of `upload_inquiry_file` after `inquiry = await get_inquiry_or_404(db, inquiry_id)` (line 329) add:

```python
    if inquiry.is_completed:
        raise HTTPException(status_code=400, detail="Event is completed and locked")
```

Same in `upload_inventory_movement_file` after `inquiry = await get_inquiry_or_404(db, inquiry_id)` (line 431).

- [x] **Step 4: Add version history to inventory movement uploads**

In `upload_inventory_movement_file`, after `for item, qty, unit in rows:` block (lines 451-459) and before `await db.commit()` (line 464), add:

```python
    ver_result = await db.execute(
        select(func.coalesce(func.max(InventoryFileVersion.version_no), 0))
        .where(
            InventoryFileVersion.inquiry_id == inquiry_id,
            InventoryFileVersion.movement_type == movement_type,
        )
    )
    next_version = (ver_result.scalar() or 0) + 1
    db.add(InventoryFileVersion(
        inquiry_id=inquiry_id,
        movement_type=movement_type,
        file_name=file.filename,
        file_path=file_path,
        version_no=next_version,
        uploaded_by=current_user.id,
    ))
```

- [x] **Step 5: Verify imports**

Run: `cd backend && python -c "import app.routers.inquiries; print('ok')"`
Expected: prints `ok`.

- [x] **Step 6: Commit**

```bash
git add backend/app/routers/inquiries.py
git commit -m "feat(inquiries): vendor/kitchen uploads, inventory version history, completion lock"
```

---

### Task 5: Event schemas

**Files:**
- Create: `backend/app/schemas/event.py`

- [x] **Step 1: Write `backend/app/schemas/event.py`**

```python
import uuid
from datetime import date, datetime
from pydantic import BaseModel


class EventListItem(BaseModel):
    id: uuid.UUID
    client_name: str
    event_type: str
    event_date: date | None = None
    venue: str | None = None
    pax: int | None = None
    status: str
    is_completed: bool = False


class EventInventoryRow(BaseModel):
    sr_no: int
    item_name: str
    required_qty: float = 0
    received_qty: float = 0
    not_received_count: int = 0
    received_status: str = "Not Received"
    transfer_count: float = 0
    returned_qty: float = 0
    unit: str | None = None
    remark: str | None = None


class EventVendorRow(BaseModel):
    id: uuid.UUID
    vendor_name: str
    service_name: str | None = None
    rate: float | None = None
    total_cost: float | None = None
    remark: str | None = None


class KitchenInventoryRow(BaseModel):
    id: uuid.UUID
    item_name: str
    prepared_qty: float = 0
    unit: str | None = None
    used_qty: float = 0
    remaining_qty: float = 0
    remark: str | None = None


class ClosureSummary(BaseModel):
    total_items: int = 0
    total_required_qty: float = 0
    total_received_qty: float = 0
    not_received_qty: float = 0
    transferred_qty: float = 0
    returned_thol_qty: float = 0
    wastage_qty: float = 0


class FileVersion(BaseModel):
    id: uuid.UUID
    movement_type: str
    file_name: str
    version_no: int
    uploaded_at: datetime
    uploaded_by_name: str | None = None


class EventDetail(BaseModel):
    id: uuid.UUID
    client_name: str
    client_phone: str | None = None
    event_type: str
    event_date: date | None = None
    pax: int | None = None
    status: str
    venue: str | None = None
    sales_head_name: str | None = None
    created_at: datetime
    is_completed: bool = False
    completed_at: datetime | None = None
    menu: dict = {}
    inventory: list[EventInventoryRow] = []
    vendors: list[EventVendorRow] = []
    total_vendor_cost: float = 0
    kitchen_inventory: list[KitchenInventoryRow] = []
    closure: ClosureSummary = ClosureSummary()
    upload_history: list[FileVersion] = []


class InventoryItemSave(BaseModel):
    item_name: str
    received_qty: float | None = None
    transfer_count: float | None = None
    returned_qty: float | None = None
    remark: str | None = None


class InventoryItemsSaveRequest(BaseModel):
    rows: list[InventoryItemSave]


class VendorSave(BaseModel):
    id: uuid.UUID
    rate: float | None = None
    total_cost: float | None = None
    remark: str | None = None


class VendorsSaveRequest(BaseModel):
    rows: list[VendorSave]
```

- [x] **Step 2: Verify import**

Run: `cd backend && python -c "from app.schemas.event import EventDetail; print('ok')"`
Expected: prints `ok`.

- [x] **Step 3: Commit**

```bash
git add backend/app/schemas/event.py
git commit -m "feat(schemas): event view bundle, closure summary, upload history schemas"
```

---

### Task 6: Event service — bundle derivation

**Files:**
- Create: `backend/app/services/event_service.py`

- [x] **Step 1: Write `backend/app/services/event_service.py`**

```python
import os
from collections import defaultdict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inquiry import Inquiry
from app.models.user import User
from app.models.inventory_movement import InventoryMovement
from app.models.event_inventory_item import EventInventoryItem
from app.models.event_vendor import EventVendor
from app.models.kitchen_inventory_item import KitchenInventoryItem
from app.models.inventory_file_version import InventoryFileVersion
from app.services.file_parsers import parse_item_qty_file


def _sum_movements(movements: list[InventoryMovement], movement_type: str) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for m in movements:
        if m.movement_type == movement_type:
            totals[m.item_name.strip().lower()] += m.quantity or 0
    return totals


def _status(received: float, required: float) -> str:
    if required <= 0:
        return "Not Received"
    if received >= required:
        return "Received"
    if received > 0:
        return "Partial"
    return "Not Received"


async def get_base_inventory_map(db: AsyncSession, inquiry: Inquiry) -> dict[str, dict]:
    """Return dict keyed by lowercased item name -> base row from ingredient excel + movements."""
    if not inquiry.ingredient_file_path or not os.path.isfile(inquiry.ingredient_file_path):
        return {}
    ext = os.path.splitext(inquiry.ingredient_file_name or "")[1].lower()
    if ext not in (".xlsx", ".csv"):
        return {}
    ingredient_items = parse_item_qty_file(inquiry.ingredient_file_path, ext)

    mov_result = await db.execute(select(InventoryMovement).where(InventoryMovement.inquiry_id == inquiry.id))
    movements = mov_result.scalars().all()
    received = _sum_movements(movements, "received")
    transferred = _sum_movements(movements, "transferred")
    returned = _sum_movements(movements, "returned")

    result: dict[str, dict] = {}
    for idx, (item, qty, unit) in enumerate(ingredient_items, start=1):
        key = item.strip().lower()
        result[key] = {
            "sr_no": idx,
            "item_name": item.strip(),
            "required_qty": qty,
            "received_qty": received.get(key, 0),
            "transfer_count": transferred.get(key, 0),
            "returned_qty": returned.get(key, 0),
            "unit": unit,
            "remark": None,
        }
    return result


async def build_event_bundle(db: AsyncSession, inquiry: Inquiry) -> dict:
    base_map = await get_base_inventory_map(db, inquiry)

    override_result = await db.execute(
        select(EventInventoryItem).where(EventInventoryItem.inquiry_id == inquiry.id)
    )
    overrides = {o.item_name.strip().lower(): o for o in override_result.scalars().all()}

    inventory_rows = []
    for key, base in base_map.items():
        ov = overrides.get(key)
        received_qty = ov.received_qty if ov is not None and ov.received_qty is not None else base["received_qty"]
        transfer_count = ov.transfer_count if ov is not None and ov.transfer_count is not None else base["transfer_count"]
        returned_qty = ov.returned_qty if ov is not None and ov.returned_qty is not None else base["returned_qty"]
        inventory_rows.append({
            "sr_no": base["sr_no"],
            "item_name": base["item_name"],
            "required_qty": base["required_qty"],
            "received_qty": received_qty,
            "not_received_count": 1 if received_qty == 0 else 0,
            "received_status": _status(received_qty, base["required_qty"]),
            "transfer_count": transfer_count,
            "returned_qty": returned_qty,
            "unit": base["unit"],
            "remark": ov.remark if ov is not None else None,
        })

    vendor_result = await db.execute(
        select(EventVendor).where(EventVendor.inquiry_id == inquiry.id).order_by(EventVendor.created_at.asc())
    )
    vendors = vendor_result.scalars().all()
    total_vendor_cost = sum(float(v.total_cost or 0) for v in vendors)

    kitchen_result = await db.execute(
        select(KitchenInventoryItem).where(KitchenInventoryItem.inquiry_id == inquiry.id).order_by(KitchenInventoryItem.created_at.asc())
    )
    kitchen_items = kitchen_result.scalars().all()

    mov_result = await db.execute(select(InventoryMovement).where(InventoryMovement.inquiry_id == inquiry.id))
    movements = mov_result.scalars().all()
    wastage_qty = sum(m.quantity or 0 for m in movements if m.movement_type == "wastage")

    sales_head_name = None
    if inquiry.assigned_to:
        user = await db.get(User, inquiry.assigned_to)
        if user:
            sales_head_name = user.full_name

    hist_result = await db.execute(
        select(InventoryFileVersion, User.full_name)
        .join(User, InventoryFileVersion.uploaded_by == User.id)
        .where(InventoryFileVersion.inquiry_id == inquiry.id)
        .order_by(InventoryFileVersion.created_at.desc())
    )
    upload_history = [
        {
            "id": str(v.id),
            "movement_type": v.movement_type,
            "file_name": v.file_name,
            "version_no": v.version_no,
            "uploaded_at": v.created_at,
            "uploaded_by_name": name,
        }
        for v, name in hist_result.all()
    ]

    closure = {
        "total_items": len(inventory_rows),
        "total_required_qty": sum(r["required_qty"] for r in inventory_rows),
        "total_received_qty": sum(r["received_qty"] for r in inventory_rows),
        "not_received_qty": sum(r["required_qty"] for r in inventory_rows if r["received_qty"] == 0),
        "transferred_qty": sum(r["transfer_count"] for r in inventory_rows),
        "returned_thol_qty": sum(r["returned_qty"] for r in inventory_rows),
        "wastage_qty": wastage_qty,
    }

    return {
        "id": str(inquiry.id),
        "client_name": inquiry.client_name,
        "client_phone": inquiry.client_phone,
        "event_type": inquiry.event_type,
        "event_date": inquiry.event_date,
        "pax": inquiry.pax,
        "status": inquiry.status.value if hasattr(inquiry.status, "value") else str(inquiry.status),
        "venue": inquiry.venue,
        "sales_head_name": sales_head_name,
        "created_at": inquiry.created_at,
        "is_completed": inquiry.is_completed,
        "completed_at": inquiry.completed_at,
        "menu": {
            "file_name": inquiry.menu_file_name,
            "uploaded": bool(inquiry.menu_file_name or inquiry.menu_content),
        },
        "inventory": inventory_rows,
        "vendors": [
            {
                "id": str(v.id),
                "vendor_name": v.vendor_name,
                "service_name": v.service_name,
                "rate": float(v.rate) if v.rate is not None else None,
                "total_cost": float(v.total_cost) if v.total_cost is not None else None,
                "remark": v.remark,
            }
            for v in vendors
        ],
        "total_vendor_cost": total_vendor_cost,
        "kitchen_inventory": [
            {
                "id": str(k.id),
                "item_name": k.item_name,
                "prepared_qty": k.prepared_qty,
                "unit": k.unit,
                "used_qty": k.used_qty,
                "remaining_qty": k.remaining_qty,
                "remark": k.remark,
            }
            for k in kitchen_items
        ],
        "closure": closure,
        "upload_history": upload_history,
    }
```

- [x] **Step 2: Verify import**

Run: `cd backend && python -c "from app.services.event_service import build_event_bundle; print('ok')"`
Expected: prints `ok`.

- [x] **Step 3: Commit**

```bash
git add backend/app/services/event_service.py
git commit -m "feat(service): derive event view bundle from ingredient excel, movements and overrides"
```

---

### Task 7: Events router + registration

**Files:**
- Create: `backend/app/routers/events.py`
- Modify: `backend/app/main.py`

- [x] **Step 1: Write `backend/app/routers/events.py`**

```python
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
        result = await db.execute(select(EventVendor).where(EventVendor.id == row.id))
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
```

- [x] **Step 2: Register router in `main.py`**

In `backend/app/main.py`:
- Add import after line 13: `from app.routers.events import router as events_router`
- Add after line 27: `app.include_router(events_router)`

- [x] **Step 3: Verify import + route registration**

Run: `cd backend && python -c "from app.main import app; print([r.path for r in app.routes if r.path.startswith('/api/events')])"`
Expected: prints the four event routes.

- [x] **Step 4: Commit**

```bash
git add backend/app/routers/events.py backend/app/main.py
git commit -m "feat(events): list, detail bundle, save inventory/vendors, complete event router"
```

---

### Task 8: Backend integration tests

**Files:**
- Create: `backend/tests/test_events.py`
- Modify: `backend/tests/conftest.py` (temp upload dir)

- [x] **Step 1: Point tests at a temp upload dir**

In `backend/tests/conftest.py`, add after `os.environ["ENVIRONMENT"] = "testing"`:

```python
os.environ["UPLOAD_DIR"] = os.path.join(os.environ.get("TEMP", "/tmp"), "shagun_test_uploads")
```

- [x] **Step 2: Write `backend/tests/test_events.py`**

```python
import os
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/tmp/shagun_test_uploads"))


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


async def create_handover_inquiry(client, token):
    resp = await client.post("/api/inquiries", headers=auth(token), json={
        "client_name": f"Ops Test {uuid.uuid4().hex[:6]}",
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


def csv_upload(file_name: str, content: str):
    return {"file": (file_name, content.encode("utf-8"), "text/csv")}


async def test_events_list_empty(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    resp = await client.get("/api/events", headers=auth(token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_events_list_and_detail(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    list_resp = await client.get("/api/events", headers=auth(token))
    assert list_resp.status_code == 200
    ids = [e["id"] for e in list_resp.json()]
    assert inquiry_id in ids

    detail_resp = await client.get(f"/api/events/{inquiry_id}", headers=auth(token))
    assert detail_resp.status_code == 200
    data = detail_resp.json()
    assert data["client_name"].startswith("Ops Test")
    assert data["is_completed"] is False
    assert data["inventory"] == []
    assert data["closure"]["total_items"] == 0


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
    assert paneer["received_qty"] == 0
    assert paneer["received_status"] == "Not Received"
    assert paneer["not_received_count"] == 1

    received = csv_upload("received.csv", "Paneer,6,kg\n")
    rec_resp = await client.post(f"/api/inquiries/{inquiry_id}/inventory-upload?movement_type=received", headers=auth(token), files=received)
    assert rec_resp.status_code == 200, rec_resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    paneer = detail["inventory"][0]
    assert paneer["received_qty"] == 6
    assert paneer["received_status"] == "Partial"

    # editing without remark -> 400
    bad = await client.post(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "rows": [{"item_name": "Paneer", "received_qty": 10, "transfer_count": None, "returned_qty": None, "remark": None}]
    })
    assert bad.status_code == 400

    # editing with remark -> ok
    ok = await client.post(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "rows": [{"item_name": "Paneer", "received_qty": 10, "transfer_count": None, "returned_qty": None, "remark": "received extra 4kg"}]
    })
    assert ok.status_code == 200, ok.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    paneer = detail["inventory"][0]
    assert paneer["received_qty"] == 10
    assert paneer["received_status"] == "Received"
    assert paneer["remark"] == "received extra 4kg"


async def test_upload_history_versions(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    for i in range(2):
        resp = await client.post(
            f"/api/inquiries/{inquiry_id}/inventory-upload?movement_type=received",
            headers=auth(token),
            files=csv_upload(f"received_v{i+1}.csv", f"Paneer,{i+1},kg\n"),
        )
        assert resp.status_code == 200, resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    history = detail["upload_history"]
    assert len(history) == 2
    versions = sorted(v["version_no"] for v in history)
    assert versions == [1, 2]
    assert history[0]["version_no"] == 2  # latest first


async def test_vendor_upload_and_total(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    vendor = csv_upload("vendor.csv", "Vendor Name,Service Name,Rate,Total Cost,Remark\nABC Catering,Staff,500,15000,staff team\nXYZ Decor,Decor,2000,8000,decor setup\n")
    resp = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=vendor", headers=auth(token), files=vendor)
    assert resp.status_code == 200, resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert len(detail["vendors"]) == 2
    assert detail["total_vendor_cost"] == 23000

    vendor_id = detail["vendors"][0]["id"]
    ok = await client.post(f"/api/events/{inquiry_id}/vendors", headers=auth(token), json={
        "rows": [{"id": vendor_id, "rate": 600, "total_cost": None, "remark": "rate increased"}]
    })
    assert ok.status_code == 200, ok.text
    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert detail["vendors"][0]["rate"] == 600


async def test_kitchen_inventory_upload(client):
    token = await login(client, "kitchen@shaguncatering.com", "kitchen123")
    admin_token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, admin_token)

    kit = csv_upload("kitchen.csv", "Item Name,Prepared Qty,Unit,Used Qty,Remaining Qty,Remark\nPaneer Tikka,50,kg,30,20,ready\nDal Makhani,80,kg,50,30,ready\n")
    resp = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=kitchen_inventory", headers=auth(token), files=kit)
    assert resp.status_code == 200, resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(admin_token))).json()
    assert len(detail["kitchen_inventory"]) == 2
    assert detail["kitchen_inventory"][0]["prepared_qty"] == 50


async def test_complete_event_locks_edits(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    ingredient = csv_upload("ingredient.csv", "Item Name,Qty,Unit\nPaneer,10,kg\n")
    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=ingredient)

    complete = await client.post(f"/api/events/{inquiry_id}/complete", headers=auth(token))
    assert complete.status_code == 200, complete.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert detail["is_completed"] is True
    assert detail["completed_at"] is not None

    # double-complete rejected
    again = await client.post(f"/api/events/{inquiry_id}/complete", headers=auth(token))
    assert again.status_code == 400

    # edits rejected after completion
    edit = await client.post(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "rows": [{"item_name": "Paneer", "received_qty": 8, "transfer_count": None, "returned_qty": None, "remark": "x"}]
    })
    assert edit.status_code == 400

    # uploads rejected after completion
    up = await client.post(f"/api/inquiries/{inquiry_id}/inventory-upload?movement_type=received", headers=auth(token), files=csv_upload("received.csv", "Paneer,5,kg\n"))
    assert up.status_code == 400


async def test_full_excel_preview_no_cap(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    rows = "\n".join(f"item{i},{i}kg" for i in range(250))
    up = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=inventory", headers=auth(token), files=csv_upload("big.csv", "Item,Qty\n" + rows + "\n"))
    assert up.status_code == 200, up.text

    preview = await client.get(f"/api/inquiries/{inquiry_id}/file/inventory/preview", headers=auth(token))
    assert preview.status_code == 200
    assert len(preview.json()["rows"]) == 251  # header + 250
```

- [x] **Step 3: Run the tests**

Run: `cd backend && python -m pytest tests/test_events.py -v`
Expected: all tests pass. If `create_handover_inquiry` returns 201 but the status PATCH fails with 403 (role), check the login user — admin is allowed. If `venue` isn't accepted by `InquiryCreate`, remove that field from the create payload (schema check in Task 5's spec: `venue` exists on InquiryCreate).

- [x] **Step 4: Run the full backend test suite**

Run: `cd backend && python -m pytest -v`
Expected: existing tests + new tests pass.

- [x] **Step 5: Commit**

```bash
git add backend/tests/
git commit -m "test(events): event bundle, edits, versions, vendors, kitchen, completion lock, full preview"
```

---

### Task 9: Frontend — event types, API client, hooks

**Files:**
- Create: `frontend/src/types/event.ts`
- Create: `frontend/src/api/events.ts`
- Create: `frontend/src/hooks/useEvents.ts`
- Modify: `frontend/src/api/inquiries.ts` (extend `InquiryFileType`)

- [x] **Step 1: Write `frontend/src/types/event.ts`**

```typescript
export interface EventListItem {
  id: string
  client_name: string
  event_type: string
  event_date: string | null
  venue: string | null
  pax: number | null
  status: string
  is_completed: boolean
}

export interface EventInventoryRow {
  sr_no: number
  item_name: string
  required_qty: number
  received_qty: number
  not_received_count: number
  received_status: string
  transfer_count: number
  returned_qty: number
  unit: string | null
  remark: string | null
}

export interface EventVendorRow {
  id: string
  vendor_name: string
  service_name: string | null
  rate: number | null
  total_cost: number | null
  remark: string | null
}

export interface KitchenInventoryRow {
  id: string
  item_name: string
  prepared_qty: number
  unit: string | null
  used_qty: number
  remaining_qty: number
  remark: string | null
}

export interface ClosureSummary {
  total_items: number
  total_required_qty: number
  total_received_qty: number
  not_received_qty: number
  transferred_qty: number
  returned_thol_qty: number
  wastage_qty: number
}

export interface FileVersion {
  id: string
  movement_type: string
  file_name: string
  version_no: number
  uploaded_at: string
  uploaded_by_name: string | null
}

export interface EventDetail {
  id: string
  client_name: string
  client_phone: string | null
  event_type: string
  event_date: string | null
  pax: number | null
  status: string
  venue: string | null
  sales_head_name: string | null
  created_at: string
  is_completed: boolean
  completed_at: string | null
  menu: { file_name: string | null; uploaded: boolean }
  inventory: EventInventoryRow[]
  vendors: EventVendorRow[]
  total_vendor_cost: number
  kitchen_inventory: KitchenInventoryRow[]
  closure: ClosureSummary
  upload_history: FileVersion[]
}

export interface InventoryItemSave {
  item_name: string
  received_qty?: number | null
  transfer_count?: number | null
  returned_qty?: number | null
  remark?: string | null
}

export interface VendorSave {
  id: string
  rate?: number | null
  total_cost?: number | null
  remark?: string | null
}
```

- [x] **Step 2: Write `frontend/src/api/events.ts`**

```typescript
import client from './client'
import type { EventListItem, EventDetail, InventoryItemSave, VendorSave } from '@/types/event'

export async function getEvents(): Promise<EventListItem[]> {
  const response = await client.get('/events')
  return response.data
}

export async function getEventDetail(id: string): Promise<EventDetail> {
  const response = await client.get(`/events/${id}`)
  return response.data
}

export async function saveInventoryItems(id: string, rows: InventoryItemSave[]): Promise<{ ok: boolean }> {
  const response = await client.post(`/events/${id}/inventory-items`, { rows })
  return response.data
}

export async function saveVendors(id: string, rows: VendorSave[]): Promise<{ ok: boolean }> {
  const response = await client.post(`/events/${id}/vendors`, { rows })
  return response.data
}

export async function completeEvent(id: string): Promise<{ ok: boolean }> {
  const response = await client.post(`/events/${id}/complete`)
  return response.data
}
```

- [x] **Step 3: Write `frontend/src/hooks/useEvents.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as eventsApi from '@/api/events'
import type { InventoryItemSave, VendorSave } from '@/types/event'

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: eventsApi.getEvents,
  })
}

export function useEventDetail(id?: string) {
  return useQuery({
    queryKey: ['event-detail', id],
    queryFn: () => eventsApi.getEventDetail(id!),
    enabled: Boolean(id),
  })
}

export function useSaveInventoryItems(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rows: InventoryItemSave[]) => eventsApi.saveInventoryItems(id, rows),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-detail', id] }),
  })
}

export function useSaveVendors(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rows: VendorSave[]) => eventsApi.saveVendors(id, rows),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-detail', id] }),
  })
}

export function useCompleteEvent(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => eventsApi.completeEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-detail', id] }),
  })
}
```

- [x] **Step 4: Extend `InquiryFileType` in `frontend/src/api/inquiries.ts`**

Replace line 102:

```typescript
export type InquiryFileType = 'menu' | 'presentation' | 'ingredient' | 'inventory' | 'returned' | 'transferred' | 'wastage' | 'vendor' | 'kitchen_inventory' | 'call_recording'
```

- [x] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [x] **Step 6: Commit**

```bash
git add frontend/src/types/event.ts frontend/src/api/events.ts frontend/src/hooks/useEvents.ts frontend/src/api/inquiries.ts
git commit -m "feat(events): frontend types, api client, hooks"
```

---

### Task 10: Event List page + route + sidebar

**Files:**
- Create: `frontend/src/pages/events/EventList.tsx`
- Modify: `frontend/src/routes/index.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [x] **Step 1: Write `frontend/src/pages/events/EventList.tsx`**

```tsx
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Eye, CheckCircle2 } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useEvents } from '@/hooks/useEvents'
import { INQUIRY_STATUSES } from '@/lib/constants'

export default function EventList() {
  const navigate = useNavigate()
  const { data: events = [], isLoading } = useEvents()

  return (
    <div className="space-y-5">
      <PageHeader title="Events" subtitle="All operation handover events — click to open Event View" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <CalendarDays size={14} className="text-maroon" /> Event List
          </h3>
          <span className="rounded-full bg-maroon/10 px-2 py-0.5 text-[10px] font-bold text-maroon">{events.length} events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Client Name', 'Event Type', 'Event Date', 'Venue', 'Pax', 'Status', 'Completed', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">Loading events...</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No operation handover events yet.</td></tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-900">{evt.client_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{evt.event_type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{evt.event_date ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{evt.venue ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{evt.pax ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                      {INQUIRY_STATUSES[evt.status as keyof typeof INQUIRY_STATUSES]?.label ?? evt.status}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {evt.is_completed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 size={10} /> Completed
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/events/${evt.id}`)}
                        className="flex items-center gap-1 rounded bg-maroon px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-maroon-dark"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
```

- [x] **Step 2: Add routes in `frontend/src/routes/index.tsx`**

Add imports after line 17:

```tsx
import EventList from '@/pages/events/EventList'
import EventView from '@/pages/events/EventView'
```

Add routes after the `operations` route (after line 133):

```tsx
      {
        path: 'events',
        element: (
          <ProtectedRoute allowedRoles={['operations_manager', 'kitchen', 'admin']}>
            <EventList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'events/:id',
        element: (
          <ProtectedRoute allowedRoles={['operations_manager', 'kitchen', 'admin']}>
            <EventView />
          </ProtectedRoute>
        ),
      },
```

Note: `EventView` is created in Task 11 — do not run a build until Task 11 is done.

- [x] **Step 3: Add sidebar item**

In `frontend/src/components/layout/Sidebar.tsx`:
- Add `CalendarDays` to the lucide-react import list.
- Add after line 38 (the Operations item):

```tsx
  { to: '/events', label: 'Event', icon: CalendarDays, roles: ['operations_manager', 'kitchen', 'admin'] },
```

- [x] **Step 4: Commit (EventList only — route references EventView so commit after Task 11)**

Proceed to Task 11; commit both tasks together at the end of Task 11.

---

### Task 11: Event View page

**Files:**
- Create: `frontend/src/pages/events/EventView.tsx`

- [x] **Step 1: Write `frontend/src/pages/events/EventView.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Upload,
  CheckCircle2,
  Lock,
  FileText,
  Loader2,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useEventDetail, useSaveInventoryItems, useSaveVendors, useCompleteEvent } from '@/hooks/useEvents'
import { downloadInquiryFile, uploadInquiryFile } from '@/api/inquiries'
import type { EventInventoryRow, EventVendorRow } from '@/types/event'
import { getErrorMessage } from '@/lib/apiError'
import { INQUIRY_STATUSES } from '@/lib/constants'

const EDITABLE_ROLES = ['operations_manager', 'admin', 'warehouse']
const KITCHEN_UPLOAD_ROLES = ['kitchen', 'admin']
const VENDOR_UPLOAD_ROLES = ['operations_manager', 'admin', 'warehouse']

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-left">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 px-5 py-4">{children}</div>}
    </motion.div>
  )
}

export default function EventView() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role?.name ?? ''
  const { data, isLoading } = useEventDetail(id)
  const saveItems = useSaveInventoryItems(id)
  const saveVendors = useSaveVendors(id)
  const complete = useCompleteEvent(id)

  const canEdit = !data?.is_completed && EDITABLE_ROLES.includes(role)
  const canComplete = !data?.is_completed && (role === 'operations_manager' || role === 'admin')

  const [inventoryRows, setInventoryRows] = useState<EventInventoryRow[]>([])
  const [vendorRows, setVendorRows] = useState<EventVendorRow[]>([])
  const [savedInventory, setSavedInventory] = useState<EventInventoryRow[]>([])
  const [savedVendors, setSavedVendors] = useState<EventVendorRow[]>([])

  useMemo(() => {
    if (data) {
      setInventoryRows(data.inventory)
      setVendorRows(data.vendors)
      setSavedInventory(JSON.parse(JSON.stringify(data.inventory)))
      setSavedVendors(JSON.parse(JSON.stringify(data.vendors)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, data?.inventory, data?.vendors])

  const updateRow = (itemName: string, patch: Partial<EventInventoryRow>) => {
    setInventoryRows((prev) => prev.map((r) => (r.item_name === itemName ? { ...r, ...patch } : r)))
  }
  const updateVendor = (vid: string, patch: Partial<EventVendorRow>) => {
    setVendorRows((prev) => prev.map((v) => (v.id === vid ? { ...v, ...patch } : v)))
  }

  const handleUpload = async (fileType: 'vendor' | 'kitchen_inventory', file?: File) => {
    if (!file) return
    try {
      await uploadInquiryFile(id, fileType, file)
      toast.success(`${fileType === 'vendor' ? 'Vendor' : 'Kitchen inventory'} excel uploaded`)
      window.location.reload()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'))
    }
  }

  const saveInventory = () => {
    const payload = inventoryRows.map((r) => {
      const orig = savedInventory.find((s) => s.item_name === r.item_name)
      const changed =
        (orig && r.received_qty !== orig.received_qty) ||
        (orig && r.transfer_count !== orig.transfer_count) ||
        (orig && r.returned_qty !== orig.returned_qty)
      return {
        item_name: r.item_name,
        received_qty: changed ? r.received_qty : null,
        transfer_count: changed ? r.transfer_count : null,
        returned_qty: changed ? r.returned_qty : null,
        remark: r.remark,
      }
    })
    const missing = payload.filter((p) => (p.received_qty !== null || p.transfer_count !== null || p.returned_qty !== null) && !(p.remark || '').trim())
    if (missing.length > 0) {
      toast.error(`Remark is mandatory for: ${missing.map((m) => m.item_name).join(', ')}`)
      return
    }
    saveItems.mutate(payload, {
      onSuccess: () => toast.success('Inventory saved'),
      onError: (err) => toast.error(getErrorMessage(err, 'Save failed')),
    })
  }

  const saveVendor = () => {
    const payload = vendorRows.map((v) => {
      const orig = savedVendors.find((s) => s.id === v.id)
      const changed = orig && (v.rate !== orig.rate || v.total_cost !== orig.total_cost)
      return { id: v.id, rate: changed ? v.rate : null, total_cost: changed ? v.total_cost : null, remark: v.remark }
    })
    const missing = payload.filter((p) => (p.rate !== null || p.total_cost !== null) && !(p.remark || '').trim())
    if (missing.length > 0) {
      toast.error('Remark is mandatory when changing vendor rate/cost')
      return
    }
    saveVendors.mutate(payload, {
      onSuccess: () => toast.success('Vendors saved'),
      onError: (err) => toast.error(getErrorMessage(err, 'Save failed')),
    })
  }

  const handleComplete = () => {
    if (!window.confirm('Mark this event as completed? All editing will be locked for everyone.')) return
    complete.mutate(undefined, {
      onSuccess: () => toast.success('Event marked as completed'),
      onError: (err) => toast.error(getErrorMessage(err, 'Failed to complete event')),
    })
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400">Loading event...</div>
  }
  if (!data) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400">Event not found</div>
  }

  const invCols = ['Sr No', 'Item Name', 'Required Qty', 'Received Qty', 'Not Received Item Count', 'Received Status', 'Transfer Item Count', 'Returned to THOL Qty', 'Remark']

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          {data.is_completed && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
              <Lock size={11} /> Event Completed — Read Only
            </span>
          )}
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
            INQUIRY_STATUSES[data.status as keyof typeof INQUIRY_STATUSES]?.color ?? 'bg-gray-100 text-gray-700'
          }`}>
            {INQUIRY_STATUSES[data.status as keyof typeof INQUIRY_STATUSES]?.label ?? data.status}
          </span>
        </div>
      </div>

      <PageHeader title={data.client_name} subtitle={`${data.event_type} · ${data.event_date ?? 'No date'} · Pax ${data.pax ?? '—'}`} />

      {/* 1. Event Details */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
        <h3 className="mb-4 text-sm font-bold text-gray-900">Event Details</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          {[
            ['Event Name', data.client_name],
            ['Event Date', data.event_date ?? '—'],
            ['Pax', data.pax ?? '—'],
            ['Event Type', data.event_type],
            ['Status', INQUIRY_STATUSES[data.status as keyof typeof INQUIRY_STATUSES]?.label ?? data.status],
            ['Client Name', data.client_name],
            ['Venue', data.venue ?? '—'],
            ['Sales Head', data.sales_head_name ?? '—'],
            ['Created Date', data.created_at ? new Date(data.created_at).toLocaleDateString('en-IN') : '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 2. Documents — Menu only */}
      <Section title="Documents — Menu">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-emerald-500" />
            <span className="text-xs font-semibold text-gray-900">Menu</span>
            {data.menu.uploaded ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Ready</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => data.menu.file_name && downloadInquiryFile(id, 'menu', data.menu.file_name)}
              disabled={!data.menu.uploaded}
              className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              <Download size={12} /> Download
            </button>
          </div>
        </div>
      </Section>

      {/* 3. Inventory List */}
      <Section title="Inventory List">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {invCols.map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventoryRows.length === 0 ? (
                <tr><td colSpan={invCols.length} className="px-3 py-10 text-center text-xs text-gray-400">No inventory yet — upload the kitchen's Ingredient Excel to populate Required Qty.</td></tr>
              ) : inventoryRows.map((row) => (
                <tr key={row.item_name} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500">{row.sr_no}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{row.item_name}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-700">{row.required_qty} {row.unit ?? ''}</td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={row.received_qty}
                      onChange={(e) => updateRow(row.item_name, { received_qty: Number(e.target.value) })}
                      className="w-20 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-600">{row.not_received_count}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      row.received_status === 'Received' ? 'bg-emerald-100 text-emerald-700'
                      : row.received_status === 'Partial' ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                    }`}>{row.received_status}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={row.transfer_count}
                      onChange={(e) => updateRow(row.item_name, { transfer_count: Number(e.target.value) })}
                      className="w-20 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={row.returned_qty}
                      onChange={(e) => updateRow(row.item_name, { returned_qty: Number(e.target.value) })}
                      className="w-20 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      value={row.remark ?? ''}
                      disabled={!canEdit}
                      onChange={(e) => updateRow(row.item_name, { remark: e.target.value })}
                      placeholder="Remark"
                      className="w-40 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <button onClick={saveInventory} disabled={saveItems.isPending}
            className="mt-4 flex items-center gap-1 rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white hover:bg-maroon-dark disabled:opacity-50">
            {saveItems.isPending ? <Loader2 size={12} className="animate-spin" /> : null} Save Inventory Changes
          </button>
        )}
      </Section>

      {/* 4. Vendor Details */}
      <Section title="Vendor Details">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Sr No', 'Vendor Name', 'Service Name', 'Rate (₹)', 'Total Cost (₹)', 'Remark'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorRows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-gray-400">No vendors yet — upload a Vendor Excel.</td></tr>
              ) : vendorRows.map((v, i) => (
                <tr key={v.id} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{v.vendor_name}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{v.service_name ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <input type="number" disabled={!canEdit} value={v.rate ?? ''}
                      onChange={(e) => updateVendor(v.id, { rate: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-24 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500" />
                  </td>
                  <td className="px-3 py-2.5">
                    <input type="number" disabled={!canEdit} value={v.total_cost ?? ''}
                      onChange={(e) => updateVendor(v.id, { total_cost: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-24 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500" />
                  </td>
                  <td className="px-3 py-2.5">
                    <input value={v.remark ?? ''} disabled={!canEdit}
                      onChange={(e) => updateVendor(v.id, { remark: e.target.value })}
                      placeholder="Remark"
                      className="w-40 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500">Total Vendor Cost</td>
                <td className="px-3 py-2.5 text-sm font-bold tabular-nums text-gray-900">₹ {data.total_vendor_cost.toLocaleString('en-IN')}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {VENDOR_UPLOAD_ROLES.includes(role) && (
            <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
              <Upload size={12} /> Upload Vendor Excel
              <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => { handleUpload('vendor', e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )}
          {canEdit && (
            <button onClick={saveVendor} disabled={saveVendors.isPending}
              className="flex items-center gap-1 rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white hover:bg-maroon-dark disabled:opacity-50">
              {saveVendors.isPending ? <Loader2 size={12} className="animate-spin" /> : null} Save Vendor Changes
            </button>
          )}
        </div>
      </Section>

      {/* 5. Kitchen Inventory */}
      <Section title="Kitchen Inventory">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Sr No', 'Item Name', 'Prepared Qty', 'Unit', 'Used Qty', 'Remaining Qty', 'Remark'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.kitchen_inventory.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-gray-400">No kitchen inventory uploaded yet.</td></tr>
              ) : data.kitchen_inventory.map((k, i) => (
                <tr key={k.id} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{k.item_name}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-700">{k.prepared_qty}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{k.unit ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-700">{k.used_qty}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-700">{k.remaining_qty}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{k.remark ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {KITCHEN_UPLOAD_ROLES.includes(role) && (
          <label className="mt-4 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
            <Upload size={12} /> Upload Kitchen Inventory Excel
            <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => { handleUpload('kitchen_inventory', e.target.files?.[0]); e.target.value = '' }} />
          </label>
        )}
      </Section>

      {/* 6. Inventory Closure Summary */}
      <Section title="Inventory Closure Summary">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Total Items', data.closure.total_items],
            ['Total Required Qty', data.closure.total_required_qty],
            ['Total Received Qty', data.closure.total_received_qty],
            ['Not Received Qty', data.closure.not_received_qty],
            ['Transferred Qty', data.closure.transferred_qty],
            ['Returned to THOL Qty', data.closure.returned_thol_qty],
            ['Wastage Qty', data.closure.wastage_qty],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-100 bg-cream p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 7. Mark Event as Completed */}
      {canComplete && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <button onClick={handleComplete} disabled={complete.isPending}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {complete.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Mark Event as Completed
          </button>
        </motion.div>
      )}
    </div>
  )
}
```

- [x] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [x] **Step 3: Commit Task 10 + 11 together**

```bash
git add frontend/src/pages/events/ frontend/src/routes/index.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(events): event list and event view pages with sidebar + routes"
```

---

### Task 12: Operations Dashboard — real schedule, no completion card, Event View links

**Files:**
- Modify: `frontend/src/pages/operations/OperationsDashboard.tsx`

- [x] **Step 1: Replace the sample data and KPI grid**

In `frontend/src/pages/operations/OperationsDashboard.tsx`:
- Delete the `todayEvents` array (lines 22-26).
- Keep imports but add `Clock, Building2` already present; add `todayISO`:

Add near the top of the component body (after `const confirmedEvents = ...` line 34):

```tsx
  const todayISO = new Date().toISOString().slice(0, 10)
  const todaysEvents = confirmedEvents.filter((e) => e.event_date === todayISO)
```

- Replace the 5-card grid (lines 57-81) with 4 cards (remove the Completion Rate entry and change the grid to `grid-cols-4`):

```tsx
      {/* Top Row — 4 KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: 'Upcoming Events', value: kpis?.upcoming_events ?? 0, color: 'text-blue-600', to: '/events' },
              { label: "Today's Events", value: kpis?.todays_events ?? 0, color: 'text-amber-600', to: '/events' },
              { label: 'Pending Kitchen Plans', value: kpis?.pending_kitchen_plans ?? 0, color: 'text-rose-600', to: '/events' },
              { label: 'Pending Warehouse Requests', value: kpis?.pending_warehouse_requests ?? 0, color: 'text-emerald-600', to: '/events' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                onClick={() => navigate(kpi.to)}
                className="cursor-pointer rounded-xl border border-gray-100 bg-white p-4 shadow-md transition-shadow hover:shadow-lg"
                style={{ height: 95 }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{kpi.label}</p>
                <p className={`mt-2 text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              </motion.div>
            ))}
      </div>
```

- [x] **Step 2: Replace the Today's Schedule body**

Replace the `{todayEvents.map(...)}` block (lines 95-110) with real events:

```tsx
          <div className="flex-1 space-y-3 overflow-y-auto">
            {todaysEvents.length === 0 ? (
              <p className="flex h-full items-center justify-center text-xs text-gray-400">No events scheduled for today.</p>
            ) : (
              todaysEvents.map((evt, i) => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  onClick={() => navigate(`/events/${evt.id}`)}
                  className="cursor-pointer rounded-lg border border-gray-100 bg-white p-3.5 transition-shadow hover:shadow-md"
                  style={{ borderLeft: '4px solid #D97706' }}
                >
                  <p className="text-sm font-bold text-gray-900">{evt.client_name}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={10} /> {evt.event_type}</span>
                    <span className="flex items-center gap-1"><Building2 size={10} /> {evt.venue}</span>
                    {evt.is_completed ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Completed</span>
                    ) : null}
                  </div>
                </motion.div>
              ))
            )}
          </div>
```

Note: `evt.is_completed` doesn't exist on the `Inquiry` type returned by `useInquiries`. Either remove that badge or keep it simple — remove it:

```tsx
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={10} /> {evt.event_type}</span>
                    <span className="flex items-center gap-1"><Building2 size={10} /> {evt.venue}</span>
                  </div>
```

- [x] **Step 3: Make the Upcoming Events eye button navigate to Event View**

Replace the eye button onClick (lines 150-155) with:

```tsx
                          <button
                            onClick={() => navigate(`/events/${inq.id}`)}
                            className="rounded bg-maroon p-1.5 text-white hover:bg-maroon-dark"
                            title="Open Event View">
                            <Eye size={14} />
                          </button>
```

- [x] **Step 4: Remove the InventoryPanelModal usage**

- Remove the `InventoryPanelModal` import (line 9), the `selectedInquiry` state (line 37), and the `<InventoryPanelModal ... />` block (lines 179-183).

- [x] **Step 5: Typecheck + build**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [x] **Step 6: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors (or only pre-existing warnings).

- [x] **Step 7: Commit**

```bash
git add frontend/src/pages/operations/OperationsDashboard.tsx
git commit -m "feat(operations): real today's schedule, 4 KPI cards, event view links"
```

---

### Task 13: Full verification + spec cross-check

**Files:**
- Verify: backend tests, frontend build

- [x] **Step 1: Run backend tests**

Run: `cd backend && python -m pytest -v`
Expected: all tests pass (existing + new event tests).

- [x] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [x] **Step 3: Spec cross-check**

Verify each spec item maps to a task:
1. Operations home: Completion Rate removed, real Today's Schedule → Task 12.
2. Event sidebar + Event list page → Tasks 10.
3. Full Excel preview (no 200/12 caps) → Task 3.
4. Excel upload history, latest first → Tasks 1, 2, 4, 7 (version table + history in bundle).
5. Event View layout flow (Details → Menu → Inventory → Vendors → Kitchen → Closure → Complete) → Task 11.
6. Mark Event as Completed locks edits → Tasks 4, 7, 11.

- [x] **Step 4: Final commit (any leftover)**

```bash
git add -A
git commit -m "chore: operations db feature complete"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-13-lalit-operations-db.md`.

## Completion Record

All 13 tasks implemented and committed (see git log `046c5ce` → `48144b6`). Task 13 verified:

- Backend: `python -m pytest -v` → **39 passed**.
- Frontend: `npm run build` → **build succeeds** (only a chunk-size warning).
- Spec cross-check: all 6 spec items map to implemented tasks and pass.
- All 57 plan checkboxes marked complete in a final commit.

Final commit message: `chore: operations db feature complete`
