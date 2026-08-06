# Two-Stage Inquiry System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure inquiry page into 2 stages — Stage 1 (basic info + follow-up tracking) and Stage 2 (financial details + handover) with role-based access and status-driven visibility.

**Architecture:** New status enum, new DB fields + FollowUpHistory table, role-gated Stage 2 UI, progress-driven conditional rendering.

**Tech Stack:** FastAPI + SQLAlchemy async, Pydantic V2, React 19 + react-hook-form, zod, TypeScript

---

## File Structure

### Backend — New/Modified files
- `backend/app/models/inquiry.py` — Update InquiryStatus enum, add stage 2 fields, add FollowUpHistory model
- `backend/app/schemas/inquiry.py` — Update schemas with new fields, add FollowUpHistory schema
- `backend/app/services/inquiry_service.py` — Update status transitions
- `backend/app/routers/inquiries.py` — Add follow-up history endpoint, update payment endpoint
- `backend/app/models/__init__.py` — Export FollowUpHistory
- `backend/alembic/versions/8947_add_stage2_fields_and_followup_history.py` — Migration

### Frontend — Modified files
- `frontend/src/types/inquiry.ts` — New status union + new fields
- `frontend/src/lib/constants.ts` — New status labels/colors
- `frontend/src/pages/inquiries/InquiryDetail.tsx` — Complete restructure into 2 stages
- `frontend/src/pages/inquiries/InquiryForm.tsx` — Add stage 2 fields

---

### Task 1: Update Backend Model + Add FollowUpHistory

**Files:**
- Modify: `backend/app/models/inquiry.py`
- Modify: `backend/app/models/__init__.py`

**Steps:**

- [ ] **Step 1.1: Update InquiryStatus enum and add new fields**

Replace the enum and model in `backend/app/models/inquiry.py`:

```python
import uuid
from datetime import date, datetime
from sqlalchemy import String, Text, Integer, Numeric, Date, DateTime, Enum, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin
import enum


class InquiryStatus(str, enum.Enum):
    NEW_INQUIRY = "new_inquiry"
    FOLLOWUP = "followup"
    CLIENT_CONFIRMATION = "client_confirmation"
    MENU_SENT = "menu_sent"
    ADVANCE_RECEIVE = "advance_receive"
    OPERATION_HANDOVER = "operation_handover"


class PaymentStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"


class Inquiry(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "inquiries"

    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    client_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    inquiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pax: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_plate_rate: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    add_on: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0, nullable=True)
    status: Mapped[InquiryStatus] = mapped_column(
        Enum(InquiryStatus), default=InquiryStatus.NEW_INQUIRY, nullable=False
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    advance_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.UNPAID, nullable=False
    )

    # Stage 2 fields
    method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    method_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    advance_payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    remaining_payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class FollowUpHistory(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "follow_up_history"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False
    )
    old_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    new_date: Mapped[date] = mapped_column(Date, nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

- [ ] **Step 1.2: Export FollowUpHistory**

In `backend/app/models/__init__.py`, add:
```python
from app.models.inquiry import Inquiry, FollowUpHistory
```
And add `"FollowUpHistory"` to the `__all__` list.

---

### Task 2: Create Alembic Migration

**Files:**
- Create: `backend/alembic/versions/8947_add_stage2_fields_and_followup_history.py`

- [ ] **Step 2.1: Create migration file**

```python
"""add stage2 fields and follow_up_history table

Revision ID: 8947
Revises: 8946af221a03
Create Date: 2026-07-29 15:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "8947"
down_revision: Union[str, None] = "8946af221a03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "follow_up_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inquiry_id", sa.Uuid(), nullable=False),
        sa.Column("old_date", sa.Date(), nullable=True),
        sa.Column("new_date", sa.Date(), nullable=False),
        sa.Column("changed_by", sa.Uuid(), nullable=False),
        sa.Column("changed_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column("inquiries", sa.Column("method", sa.String(100), nullable=True))
    op.add_column("inquiries", sa.Column("method_details", sa.Text(), nullable=True))
    op.add_column("inquiries", sa.Column("advance_payment_date", sa.Date(), nullable=True))
    op.add_column("inquiries", sa.Column("remaining_payment_date", sa.Date(), nullable=True))

    # Create new status enum type
    op.execute("ALTER TABLE inquiries ALTER COLUMN status TYPE VARCHAR(50)")
    op.execute("DROP TYPE IF EXISTS inquirystatus CASCADE")


def downgrade() -> None:
    op.drop_column("inquiries", "remaining_payment_date")
    op.drop_column("inquiries", "advance_payment_date")
    op.drop_column("inquiries", "method_details")
    op.drop_column("inquiries", "method")
    op.drop_table("follow_up_history")
```

- [ ] **Step 2.2: Run migration inside backend container**

```bash
docker exec shaguncrm-backend-1 alembic upgrade head
```

---

### Task 3: Update Backend Schemas

**Files:**
- Modify: `backend/app/schemas/inquiry.py`

- [ ] **Step 3.1: Update InquiryCreate, InquiryUpdate, InquiryResponse**

Replace the content with:

```python
import uuid
from datetime import date, datetime
from pydantic import BaseModel, model_validator
from app.models.inquiry import InquiryStatus, PaymentStatus


class InquiryCreate(BaseModel):
    client_name: str
    client_phone: str
    event_type: str
    event_date: date | None = None
    inquiry_date: date | None = None
    pax: int | None = None
    per_plate_rate: float | None = None
    add_on: float | None = None
    assigned_to: str | None = None
    follow_up_date: date | None = None
    remarks: str | None = None
    # Stage 2 fields (set later)
    method: str | None = None
    method_details: str | None = None
    advance_payment_date: date | None = None
    remaining_payment_date: date | None = None


class InquiryUpdate(BaseModel):
    client_name: str | None = None
    client_phone: str | None = None
    event_type: str | None = None
    event_date: date | None = None
    inquiry_date: date | None = None
    pax: int | None = None
    per_plate_rate: float | None = None
    add_on: float | None = None
    assigned_to: str | None = None
    follow_up_date: date | None = None
    remarks: str | None = None
    # Stage 2 fields
    method: str | None = None
    method_details: str | None = None
    advance_payment_date: date | None = None
    remaining_payment_date: date | None = None


class InquiryResponse(BaseModel):
    id: uuid.UUID
    client_name: str
    client_phone: str
    event_type: str
    event_date: date | None
    inquiry_date: date | None
    pax: int | None
    per_plate_rate: float | None
    add_on: float | None
    total_amount: float | None = None
    status: InquiryStatus
    assigned_to: str | None
    created_by: str
    follow_up_date: date | None
    remarks: str | None
    advance_amount: float
    payment_status: PaymentStatus
    # Stage 2
    method: str | None = None
    method_details: str | None = None
    advance_payment_date: date | None = None
    remaining_payment_date: date | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

    @model_validator(mode="after")
    def compute_total(self):
        if self.per_plate_rate is not None and self.pax is not None:
            self.total_amount = float(self.per_plate_rate) * self.pax + float(self.add_on or 0)
        return self


class FollowUpHistoryResponse(BaseModel):
    id: uuid.UUID
    inquiry_id: uuid.UUID
    old_date: date | None
    new_date: date
    changed_by: str
    changed_at: datetime

    class Config:
        from_attributes = True
```

---

### Task 4: Update Status Transitions in Service

**Files:**
- Modify: `backend/app/services/inquiry_service.py`

- [ ] **Step 4.1: Update transition rules**

```python
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus

VALID_STATUS_TRANSITIONS = {
    InquiryStatus.NEW_INQUIRY: [InquiryStatus.FOLLOWUP, InquiryStatus.CLIENT_CONFIRMATION],
    InquiryStatus.FOLLOWUP: [InquiryStatus.CLIENT_CONFIRMATION, InquiryStatus.NEW_INQUIRY],
    InquiryStatus.CLIENT_CONFIRMATION: [InquiryStatus.MENU_SENT, InquiryStatus.FOLLOWUP],
    InquiryStatus.MENU_SENT: [InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.CLIENT_CONFIRMATION],
    InquiryStatus.ADVANCE_RECEIVE: [InquiryStatus.OPERATION_HANDOVER, InquiryStatus.MENU_SENT],
    InquiryStatus.OPERATION_HANDOVER: [],
}


def can_transition(current: InquiryStatus, target: InquiryStatus) -> bool:
    return target in VALID_STATUS_TRANSITIONS.get(current, [])
```

---

### Task 5: Update Backend Router

**Files:**
- Modify: `backend/app/routers/inquiries.py`

- [ ] **Step 5.1: Add follow-up history endpoint + record history on update**

Add endpoint after the existing payment PATCH:

```python
from app.models.inquiry import FollowUpHistory
from app.schemas.inquiry import FollowUpHistoryResponse


@router.get("/{inquiry_id}/followup-history", response_model=list[FollowUpHistoryResponse])
async def get_followup_history(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FollowUpHistory)
        .where(FollowUpHistory.inquiry_id == inquiry_id)
        .order_by(FollowUpHistory.changed_at.desc())
    )
    return [FollowUpHistoryResponse.model_validate(h) for h in result.scalars().all()]
```

Add history recording logic in the PUT endpoint when `follow_up_date` changes:

```python
# In the PUT /{inquiry_id} handler, after fetching existing inquiry:
if data.follow_up_date is not None and data.follow_up_date != inquiry.follow_up_date:
    history_entry = FollowUpHistory(
        inquiry_id=inquiry.id,
        old_date=inquiry.follow_up_date,
        new_date=data.follow_up_date,
        changed_by=current_user.id,
    )
    db.add(history_entry)
    # Auto-change status to FOLLOWUP when follow_up_date is set
    if inquiry.status == InquiryStatus.NEW_INQUIRY and data.follow_up_date:
        inquiry.status = InquiryStatus.FOLLOWUP
```

Also update the status PATCH endpoint to use new enum values.

---

### Task 6: Update Frontend Types

**Files:**
- Modify: `frontend/src/types/inquiry.ts`

- [ ] **Step 6.1: New status union + new fields**

```typescript
export type InquiryStatus =
  | 'new_inquiry'
  | 'followup'
  | 'client_confirmation'
  | 'menu_sent'
  | 'advance_receive'
  | 'operation_handover'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface Inquiry {
  id: string
  client_name: string
  client_phone: string
  event_type: string
  event_date: string | null
  inquiry_date: string | null
  pax: number | null
  per_plate_rate: number | null
  add_on: number | null
  total_amount: number | null
  status: InquiryStatus
  assigned_to: string | null
  created_by: string
  follow_up_date: string | null
  remarks: string | null
  advance_amount: number
  payment_status: PaymentStatus
  // Stage 2 fields
  method: string | null
  method_details: string | null
  advance_payment_date: string | null
  remaining_payment_date: string | null
  created_at: string
  updated_at: string
}

export interface InquiryCreate {
  client_name: string
  client_phone: string
  event_type: string
  event_date?: string
  inquiry_date?: string
  pax?: number
  per_plate_rate?: number
  add_on?: number
  assigned_to?: string
  follow_up_date?: string
  remarks?: string
  method?: string
  method_details?: string
  advance_payment_date?: string
  remaining_payment_date?: string
}

export interface InquiryUpdate extends Partial<InquiryCreate> {}
```

---

### Task 7: Update Frontend Constants

**Files:**
- Modify: `frontend/src/lib/constants.ts`

- [ ] **Step 7.1: New status labels/colors**

Replace `INQUIRY_STATUSES` with:
```typescript
export const INQUIRY_STATUSES = {
  new_inquiry: { label: 'New Inquiry', color: 'bg-blue-100 text-blue-800' },
  followup: { label: 'Followup', color: 'bg-amber-100 text-amber-800' },
  client_confirmation: { label: 'Client Confirmation', color: 'bg-purple-100 text-purple-800' },
  menu_sent: { label: 'Menu Sent', color: 'bg-indigo-100 text-indigo-800' },
  advance_receive: { label: 'Advance Receive', color: 'bg-emerald-100 text-emerald-800' },
  operation_handover: { label: 'Operation Handover', color: 'bg-rose-100 text-rose-800' },
} as const
```

---

### Task 8: Restructure InquiryDetail Page

**Files:**
- Modify: `frontend/src/pages/inquiries/InquiryDetail.tsx`

This is the largest task. The page needs to be restructured into:

- **Stage 1** (shown always): Client, Phone, Event, Event date, Pax, Follow up date, Status dropdown, Remarks
  - Status dropdown with the 6 new statuses
  - Default: "new_inquiry"
  - When follow_up_date is set by sales_head/admin → status auto-changes to "followup"
  - Follow-up date change history shown below
  - Edit by: all roles can edit stage 1 fields

- **Stage 2** (shown when status >= "client_confirmation"):
  - Per Plate Rate, Add On, Total Amount, Advance Amount
  - Method, Method Details, Advance Payment Date, Remaining Payment Date
  - Edit by: sales_head and admin
  - View by: menu_planner and presentation_exec
  - When status reaches "operation_handover" → operations_manager, kitchen, warehouse can view

- **File uploads** (Menu + Presentation) after stage 2 is filled

- [ ] **Step 8.1: Write the restructured InquiryDetail**

Replace the entire page with a clean two-stage layout. Key structure:
- Fetch inquiry data and follow-up history
- Check user role for edit/view permissions
- Stage 1 card with all basic fields inline-editable
- Status dropdown with next valid transitions
- Stage 2 card (conditional) with financial fields
- Follow-up history timeline at bottom
- Menu/Presentation upload sections below stage 2

---

### Task 9: Build + Deploy

- [ ] **Step 9.1: Build the frontend**

```bash
cd D:\Shagun CRM\frontend
npm run build
```

- [ ] **Step 9.2: Run DB migration**

```bash
docker exec shaguncrm-backend-1 alembic upgrade head
```

- [ ] **Step 9.3: Copy built files to container**

```bash
docker cp D:\Shagun CRM\frontend\dist\. shaguncrm-frontend-1:/usr/share/nginx/html/
```

- [ ] **Step 9.4: Restart backend container**

```bash
docker compose restart backend
```

- [ ] **Step 9.5: Verify**

Visit http://localhost/inquiries — check that the new statuses appear and stage 2 fields are conditionally visible.
