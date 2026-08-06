# Multi-Follow-Up System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement this plan.

**Goal:** Replace single `follow_up_date` + `FollowUpHistory` with a `follow_ups` table enabling multiple follow-up entries before client confirmation

**Architecture:** New `FollowUp` model (1:M from Inquiry). Backend handles creation via POST create + dedicated follow-up endpoints. Frontend shows follow-ups list in InquiryDetail with "Add Follow-up" button. Stage 1 form unchanged — creates first FollowUp on POST.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + React + TanStack Query

---

### Task 1: Backend — Add FollowUp model + migration

**Files:**
- Modify: `backend/app/models/inquiry.py`

**Step 1: Add `FollowUp` model below existing models**

Add after the `FollowUpHistory` class:

```python
class FollowUp(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "follow_ups"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False
    )
    follow_up_date: Mapped[date] = mapped_column(Date, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
```

**Step 2: Remove `follow_up_date` from Inquiry model**

Delete the line:
```python
follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
```

- [ ] **Step 1: Apply changes to `inquiry.py`**

**Step 3: Create migration file**

Create `backend/alembic/versions/1234_add_followups_and_drop_followup_date.py`:

```python
"""add follow_ups table, drop follow_up_date and follow_up_history

Revision ID: 1234
Revises: 8947
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "1234"
down_revision: Union[str, None] = "8947"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create follow_ups table
    op.create_table(
        "follow_ups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inquiry_id", sa.Uuid(), nullable=False),
        sa.Column("follow_up_date", sa.Date(), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Migrate existing follow_up_date to follow_ups
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, follow_up_date, created_by, created_at FROM inquiries WHERE follow_up_date IS NOT NULL")).fetchall()
    for row in rows:
        import uuid
        conn.execute(
            sa.text("INSERT INTO follow_ups (id, inquiry_id, follow_up_date, created_by, created_at, updated_at) VALUES (:id, :inquiry_id, :follow_up_date, :created_by, :created_at, :created_at)"),
            {"id": uuid.uuid4(), "inquiry_id": row[0], "follow_up_date": row[1], "created_by": row[2], "created_at": row[3]},
        )

    # Drop old columns and table
    op.drop_column("inquiries", "follow_up_date")
    op.drop_table("follow_up_history")


def downgrade() -> None:
    op.create_table(
        "follow_up_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inquiry_id", sa.Uuid(), nullable=False),
        sa.Column("old_date", sa.Date(), nullable=True),
        sa.Column("new_date", sa.Date(), nullable=False),
        sa.Column("changed_by", sa.Uuid(), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column("inquiries", sa.Column("follow_up_date", sa.Date(), nullable=True))
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT inquiry_id, follow_up_date FROM follow_ups")).fetchall()
    for row in rows:
        conn.execute(
            sa.text("UPDATE inquiries SET follow_up_date = :d WHERE id = :id"),
            {"d": row[1], "id": row[0]},
        )
    op.drop_table("follow_ups")
```

- [ ] **Step 2: Create migration file**

- [ ] **Step 3: Copy updated model + migration into container and run migration**

```bash
docker cp "D:\Shagun CRM\backend\app\models\inquiry.py" shaguncrm-backend-1:/app/app/models/inquiry.py
docker cp "D:\Shagun CRM\backend\alembic\versions\1234_add_followups_and_drop_followup_date.py" shaguncrm-backend-1:/app/alembic/versions/
docker exec shaguncrm-backend-1 alembic upgrade head
```

---

### Task 2: Backend — Update schemas

**Files:**
- Modify: `backend/app/schemas/inquiry.py`

- [ ] **Step 1: Add FollowUpCreate and FollowUpResponse schemas**

Add after `FollowUpHistoryResponse`:

```python
class FollowUpCreate(BaseModel):
    follow_up_date: date
    remarks: str | None = None


class FollowUpResponse(BaseModel):
    id: uuid.UUID
    inquiry_id: uuid.UUID
    follow_up_date: date
    remarks: str | None
    created_by: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Remove `follow_up_date` from schemas**

From `InquiryCreate`:
```python
# Remove these lines:
# follow_up_date: date | None = None
```

From `InquiryUpdate`:
```python
# Remove these lines:
# follow_up_date: date | None = None
```

From `InquiryResponse`:
```python
# Remove these lines:
# follow_up_date: date | None
```

---

### Task 3: Backend — Update routers

**Files:**
- Modify: `backend/app/routers/inquiries.py`

- [ ] **Step 1: Update imports**

Add `FollowUp` to model imports, add `FollowUpCreate`, `FollowUpResponse` to schema imports.

- [ ] **Step 2: Modify POST `/api/inquiries` create endpoint**

Change to create first FollowUp if `follow_up_date` is provided in `InquiryCreate` data:

```python
@router.post("", response_model=InquiryResponse, status_code=201)
async def create_inquiry(data: InquiryCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    inquiry = Inquiry(
        id=uuid.uuid4(), client_name=data.client_name, client_phone=data.client_phone,
        event_type=data.event_type, event_date=data.event_date, pax=data.pax,
        per_plate_rate=data.per_plate_rate, add_on=data.add_on,
        assigned_to=data.assigned_to, remarks=data.remarks,
        inquiry_date=data.inquiry_date,
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
```

- [ ] **Step 3: Modify PUT `/api/inquiries/{id}` — remove follow_up_date + history logic**

Remove the block:
```python
if data.follow_up_date is not None and data.follow_up_date != inquiry.follow_up_date:
    history_entry = FollowUpHistory(...)
    db.add(history_entry)
    if inquiry.status == InquiryStatus.NEW_INQUIRY:
        inquiry.status = InquiryStatus.FOLLOWUP
```

The endpoint should still `exclude_unset` and set fields, but without the follow_up_date + history handling.

- [ ] **Step 4: Add GET `/api/inquiries/{id}/follow-ups` endpoint**

```python
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
```

- [ ] **Step 5: Add POST `/api/inquiries/{id}/follow-ups` endpoint**

```python
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
```

- [ ] **Step 6: Remove `GET /{inquiry_id}/followup-history` endpoint** (the old one)

---

### Task 4: Copy backend files to container

- [ ] **Step 1: Copy all backend files and restart**

```bash
docker cp "D:\Shagun CRM\backend\app\models\inquiry.py" shaguncrm-backend-1:/app/app/models/inquiry.py
docker cp "D:\Shagun CRM\backend\app\schemas\inquiry.py" shaguncrm-backend-1:/app/app/schemas/inquiry.py
docker cp "D:\Shagun CRM\backend\app\routers\inquiries.py" shaguncrm-backend-1:/app/app/routers/inquiries.py
docker cp "D:\Shagun CRM\backend\alembic\versions\1234_add_followups_and_drop_followup_date.py" shaguncrm-backend-1:/app/alembic/versions/
docker exec shaguncrm-backend-1 alembic upgrade head
docker restart shaguncrm-backend-1
```

---

### Task 5: Frontend — Update types

**Files:**
- Modify: `frontend/src/types/inquiry.ts`

- [ ] **Step 1: Remove `follow_up_date` from Inquiry and InquiryCreate types**

Remove lines:
```typescript
follow_up_date: string | null  // from Inquiry
follow_up_date?: string        // from InquiryCreate
```

- [ ] **Step 2: Add `FollowUp` type**

```typescript
export interface FollowUp {
  id: string
  inquiry_id: string
  follow_up_date: string
  remarks: string | null
  created_by: string
  created_at: string
}
```

---

### Task 6: Frontend — Update API layer

**Files:**
- Modify: `frontend/src/api/inquiries.ts`

- [ ] **Step 1: Add `getFollowUps` and `addFollowUp`**

```typescript
import type { FollowUp } from '@/types/inquiry'

export async function getFollowUps(id: string): Promise<FollowUp[]> {
  const response = await client.get(`/inquiries/${id}/follow-ups`)
  return response.data
}

export async function addFollowUp(id: string, data: { follow_up_date: string; remarks?: string }): Promise<FollowUp> {
  const response = await client.post(`/inquiries/${id}/follow-ups`, data)
  return response.data
}
```

- [ ] **Step 2: Remove `getFollowUpHistory`** export (delete or comment out the function)

---

### Task 7: Frontend — Update InquiryDetail

**Files:**
- Modify: `frontend/src/pages/inquiries/InquiryDetail.tsx`

This is the biggest change. Replace the follow-up date editor + history timeline with a follow-ups list + "Add Follow-up" button.

- [ ] **Step 1: Add imports**

Add to imports:
```typescript
import { getFollowUps, addFollowUp } from '@/api/inquiries'
import type { FollowUp } from '@/types/inquiry'
import { Plus, Calendar } from 'lucide-react' // if not already imported
```

- [ ] **Step 2: Add follow-ups query and add mutation**

Add near the other queries:
```typescript
const { data: followUps, refetch: refetchFollowUps } = useQuery({
  queryKey: ['follow-ups', id],
  queryFn: () => getFollowUps(id!),
  enabled: !!id,
})

const addFollowUpMutation = useMutation({
  mutationFn: (data: { follow_up_date: string; remarks?: string }) => addFollowUp(id!, data),
  onSuccess: () => {
    refetchFollowUps()
    queryClient.invalidateQueries({ queryKey: ['inquiries'] })
    toast.success('Follow-up added')
  },
  onError: () => toast.error('Failed to add follow-up'),
})
```

- [ ] **Step 3: Add state for new follow-up form**

```typescript
const [showAddFollowUp, setShowAddFollowUp] = useState(false)
const [newFollowUpDate, setNewFollowUpDate] = useState('')
const [newFollowUpRemarks, setNewFollowUpRemarks] = useState('')
```

- [ ] **Step 4: Remove follow-up date display + editor + history timeline**

Locate and REMOVE these sections from the Stage 1 details:
1. `{ label: 'Follow-up Date', value: formatDate(inquiry.follow_up_date) }` line
2. The entire follow-up date edit section (the editable inline editor with save/cancel)
3. The "Follow-up History" timeline section

- [ ] **Step 5: Add follow-ups list + "Add Follow-up" section**

Add after the Stage 1 details section:

```tsx
{/* Follow-ups Section */}
<div className="mt-4 border-t border-gray-100 pt-4">
  <div className="mb-3 flex items-center justify-between">
    <h4 className="text-sm font-semibold text-gray-900">Follow-ups</h4>
    <button
      onClick={() => setShowAddFollowUp(!showAddFollowUp)}
      className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
    >
      <Plus size={14} /> Add Follow-up
    </button>
  </div>

  {showAddFollowUp && (
    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Date *</label>
          <input
            type="date" value={newFollowUpDate}
            onChange={(e) => setNewFollowUpDate(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 px-2 text-sm"
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600">Remarks</label>
          <input
            value={newFollowUpRemarks}
            onChange={(e) => setNewFollowUpRemarks(e.target.value)}
            placeholder="Call notes, outcome..."
            className="h-8 w-full rounded-lg border border-gray-200 px-2 text-sm"
          />
        </div>
        <button
          onClick={() => {
            if (!newFollowUpDate) return
            addFollowUpMutation.mutate(
              { follow_up_date: newFollowUpDate, remarks: newFollowUpRemarks || undefined },
              { onSuccess: () => { setShowAddFollowUp(false); setNewFollowUpDate(''); setNewFollowUpRemarks('') } }
            )
          }}
          disabled={!newFollowUpDate || addFollowUpMutation.isPending}
          className="flex h-8 items-center gap-1 rounded-lg bg-gold px-3 text-xs font-medium text-white transition-colors hover:bg-gold-hover disabled:opacity-50"
        >
          {addFollowUpMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )}

  {/* Follow-ups List */}
  {followUps?.length === 0 ? (
    <p className="text-xs text-gray-400">No follow-ups yet.</p>
  ) : (
    <div className="space-y-2">
      {followUps?.map((fu) => (
        <div key={fu.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <Calendar size={14} className="text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">
              {new Date(fu.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {fu.remarks && <p className="mt-0.5 text-xs text-gray-500">{fu.remarks}</p>}
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Clean up unused imports and state variables**

Remove `getFollowUpHistory`, `followUpEdit`, `followUpDate`, etc.

---

### Task 8: Frontend — Update SalesDashboard (remove broken follow_up_date ref)

**Files:**
- Modify: `frontend/src/pages/sales/SalesDashboard.tsx`

- [ ] **Step 1: Replace follow_up_date reference in Next Follow-Up banner**

The current code at lines 254-255 uses `inq.follow_up_date`. Since that field no longer exists on the response, change the "Next Follow-Up" section to either show a simpler message or remove it. Simplest fix — just show "Upcoming follow-ups" from the actual follow-ups data when available, or keep it simple:

Replace lines 252-257 with:
```tsx
<p className="mt-1 text-xs text-blue-600">
  Manage follow-ups from the inquiry detail page.
</p>
```

Or simpler — just change the text to a static message since per-inquiry follow-ups need a dedicated fetch per inquiry.

---

### Task 9: Frontend — Update MenuGenerator (remove broken follow_up_date ref)

**Files:**
- Modify: `frontend/src/pages/menu/MenuGenerator.tsx`

- [ ] **Step 1: Replace or remove the follow_up_date display**

Line 207: `<p className="text-gray-700">{inquiry.follow_up_date ?? '—'}</p>`

Replace with something that doesn't reference follow_up_date. Either remove it or show the first follow-up date if available (but that requires fetching follow-ups). Simplest: remove the line or replace with `'—'`.

---

### Task 10: Verify and deploy

- [ ] **Step 1: Build frontend**

```bash
Set-Location -LiteralPath "D:\Shagun CRM\frontend"; npm run build
```

- [ ] **Step 2: Deploy frontend**

```bash
docker cp "D:\Shagun CRM\frontend\dist\." shaguncrm-frontend-1:/usr/share/nginx/html/
```

- [ ] **Step 3: Verify backend is running**

```bash
docker ps
docker logs shaguncrm-backend-1 --tail 10
```

- [ ] **Step 4: Test the flow end-to-end**
   - Create a new inquiry with a follow-up date
   - Verify it appears in the follow-ups list in InquiryDetail
   - Add 2 more follow-ups
   - Transition status to Client Confirmation
