# Shagun ERP — Plan 2: Backend APIs (Inquiries, Settlements, Dashboard, Notifications)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all CRUD API endpoints for inquiries, settlements, dashboard KPIs, user management, and notifications — completing the full backend API surface for Phase 1.

**Architecture:** FastAPI routers with service layer pattern. Each resource has its own router, service, and Pydantic schemas. Queries use SQLAlchemy async with filtering, pagination, and aggregation.

**Depends on:** Plan 1 (Backend Foundation) — models, auth, database, seed data must be in place.

---

## File Structure

```
backend/
├── app/
│   ├── routers/
│   │   ├── users.py          # CRUD users (admin)
│   │   ├── inquiries.py      # CRUD inquiries + status transitions
│   │   ├── settlements.py    # CRUD settlements + FnF
│   │   ├── dashboard.py      # KPI endpoints
│   │   └── notifications.py  # Notifications
│   ├── services/
│   │   ├── inquiry_service.py
│   │   ├── settlement_service.py
│   │   └── dashboard_service.py
│   └── models/
│       └── notification.py   # Notification model (new)
├── app/schemas/
│   ├── inquiry.py            # Expand existing
│   ├── settlement.py         # Expand existing
│   ├── dashboard.py          # New
│   └── notification.py       # New
```

---

### Task 1: Notification Model & Schema

**Files:**
- Create: `backend/app/models/notification.py`
- Create: `backend/app/schemas/notification.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create Notification model**

Create `backend/app/models/notification.py`:
```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, JSON, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin


class Notification(UUIDMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # inquiry_assigned, payment_received, etc.
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
```

- [ ] **Step 2: Create notification schema**

Create `backend/app/schemas/notification.py`:
```python
import uuid
from datetime import datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: uuid.UUID
    title: str
    message: str
    type: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 3: Update models __init__.py**

Add to `backend/app/models/__init__.py`:
```python
from app.models.notification import Notification

# Add to __all__:
__all__ = [
    "User", "Role", "RoleName",
    "Inquiry", "InquiryStatus", "PaymentStatus",
    "Settlement", "SettlementStatus",
    "ActivityLog",
    "Notification",
]
```

- [ ] **Step 4: Generate and apply migration**

```bash
cd D:\Shagun CRM\backend
alembic revision --autogenerate -m "add notifications table"
alembic upgrade head
```

- [ ] **Step 5: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add Notification model and schema"
```

---

### Task 2: User Management Router

**Files:**
- Create: `backend/app/routers/users.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create users router**

Create `backend/app/routers/users.py`:
```python
import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User, Role
from app.schemas.user import UserCreate, UserUpdate, UserResponse, RoleResponse
from app.schemas.common import PaginatedResponse
from app.middleware.auth import get_current_user, require_role
from app.services.auth_service import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    role: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = select(User).join(Role)
    count_query = select(func.count(User.id)).join(Role)

    if role:
        query = query.where(Role.name == role)
        count_query = count_query.where(Role.name == role)

    if search:
        search_filter = User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    return PaginatedResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Verify role exists
    role_result = await db.execute(select(Role).where(Role.id == data.role_id))
    if role_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = User(
        id=uuid.uuid4(),
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role_id=data.role_id,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    await db.flush()
    return {"message": "User deactivated"}
```

- [ ] **Step 2: Mount users router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers.users import router as users_router
# ... after auth_router
app.include_router(users_router)
```

- [ ] **Step 3: Test user endpoints**

```bash
# Login as admin
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@shaguncatering.com","password":"admin123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# List users
curl http://localhost:8000/api/users -H "Authorization: Bearer $TOKEN"

# Create a sales head user
curl -X POST http://localhost:8000/api/users -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"email":"vinod@shaguncatering.com","password":"vinod123","full_name":"Vinod Kumar","role_id":"<sales_head_role_id>"}'
```

- [ ] **Step 4: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add user management CRUD endpoints (admin only)"
```

---

### Task 3: Inquiry Service

**Files:**
- Create: `backend/app/services/inquiry_service.py`

- [ ] **Step 1: Create inquiry service**

Create `backend/app/services/inquiry_service.py`:
```python
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus
from app.models.user import User


VALID_STATUS_TRANSITIONS = {
    InquiryStatus.NEW: [InquiryStatus.FOLLOW_UP, InquiryStatus.CANCELLED],
    InquiryStatus.FOLLOW_UP: [InquiryStatus.MENU_READY, InquiryStatus.NEGOTIATION, InquiryStatus.CANCELLED],
    InquiryStatus.MENU_READY: [InquiryStatus.PRESENTATION_SENT, InquiryStatus.CANCELLED],
    InquiryStatus.PRESENTATION_SENT: [InquiryStatus.NEGOTIATION, InquiryStatus.CANCELLED],
    InquiryStatus.NEGOTIATION: [InquiryStatus.CONFIRMED, InquiryStatus.CANCELLED],
    InquiryStatus.CONFIRMED: [],  # Terminal state
    InquiryStatus.CANCELLED: [],  # Terminal state
}


def can_transition(current: InquiryStatus, target: InquiryStatus) -> bool:
    return target in VALID_STATUS_TRANSITIONS.get(current, [])


async def get_inquiry_or_404(db: AsyncSession, inquiry_id: uuid.UUID) -> Inquiry:
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inquiry = result.scalar_one_or_none()
    if inquiry is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return inquiry


async def get_inquiry_stats(db: AsyncSession) -> dict:
    total = await db.execute(select(func.count(Inquiry.id)))
    confirmed = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CONFIRMED)
    )
    cancelled = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CANCELLED)
    )
    pending_payment = await db.execute(
        select(func.count(Inquiry.id)).where(
            Inquiry.status == InquiryStatus.CONFIRMED,
            Inquiry.payment_status != PaymentStatus.PAID,
        )
    )
    return {
        "total": total.scalar() or 0,
        "confirmed": confirmed.scalar() or 0,
        "cancelled": cancelled.scalar() or 0,
        "pending_payments": pending_payment.scalar() or 0,
    }
```

- [ ] **Step 2: Verify service imports**

```bash
cd D:\Shagun CRM\backend
python -c "from app.services.inquiry_service import can_transition, get_inquiry_stats; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add inquiry service (status transitions, stats)"
```

---

### Task 4: Inquiry Router (Full CRUD)

**Files:**
- Create: `backend/app/routers/inquiries.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create inquiries router**

Create `backend/app/routers/inquiries.py`:
```python
import uuid
import math
from datetime import date
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
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = None,
    assigned_to: uuid.UUID | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
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
        search_filter = or_(
            Inquiry.client_name.ilike(f"%{search}%"),
            Inquiry.client_phone.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if date_from:
        query = query.where(Inquiry.event_date >= date_from)
        count_query = count_query.where(Inquiry.event_date >= date_from)

    if date_to:
        query = query.where(Inquiry.event_date <= date_to)
        count_query = count_query.where(Inquiry.event_date <= date_to)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Inquiry.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    inquiries = result.scalars().all()

    return PaginatedResponse(
        items=[InquiryResponse.model_validate(i) for i in inquiries],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{inquiry_id}", response_model=InquiryResponse)
async def get_inquiry(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    return InquiryResponse.model_validate(inquiry)


@router.post("", response_model=InquiryResponse, status_code=201)
async def create_inquiry(
    data: InquiryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = Inquiry(
        id=uuid.uuid4(),
        client_name=data.client_name,
        client_phone=data.client_phone,
        event_type=data.event_type,
        event_date=data.event_date,
        pax=data.pax,
        budget=data.budget,
        assigned_to=data.assigned_to,
        follow_up_date=data.follow_up_date,
        remarks=data.remarks,
        created_by=current_user.id,
        status=InquiryStatus.NEW,
        payment_status=PaymentStatus.UNPAID,
    )
    db.add(inquiry)
    await db.flush()
    await db.refresh(inquiry)
    return InquiryResponse.model_validate(inquiry)


@router.put("/{inquiry_id}", response_model=InquiryResponse)
async def update_inquiry(
    inquiry_id: uuid.UUID,
    data: InquiryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(inquiry, field, value)
    await db.flush()
    await db.refresh(inquiry)
    return InquiryResponse.model_validate(inquiry)


@router.patch("/{inquiry_id}/status")
async def update_status(
    inquiry_id: uuid.UUID,
    new_status: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    target_status = InquiryStatus(new_status)

    if not can_transition(inquiry.status, target_status):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{inquiry.status.value}' to '{target_status.value}'",
        )

    inquiry.status = target_status
    await db.flush()
    return {"message": f"Status updated to {target_status.value}"}


@router.patch("/{inquiry_id}/payment")
async def update_payment(
    inquiry_id: uuid.UUID,
    payment_status: str,
    advance_amount: float | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = await get_inquiry_or_404(db, inquiry_id)

    if inquiry.status != InquiryStatus.CONFIRMED:
        raise HTTPException(
            status_code=400,
            detail="Payment can only be updated for confirmed inquiries",
        )

    inquiry.payment_status = PaymentStatus(payment_status)
    if advance_amount is not None:
        from decimal import Decimal
        inquiry.advance_amount = Decimal(str(advance_amount))

    await db.flush()
    return {"message": f"Payment status updated to {payment_status.value}"}
```

- [ ] **Step 2: Mount inquiries router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers.inquiries import router as inquiries_router
app.include_router(inquiries_router)
```

- [ ] **Step 3: Test inquiry endpoints**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@shaguncatering.com","password":"admin123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Create inquiry
curl -X POST http://localhost:8000/api/inquiries -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"client_name":"Sharma Family","client_phone":"9876543210","event_type":"wedding","event_date":"2026-08-15","pax":200,"budget":500000}'

# List inquiries
curl "http://localhost:8000/api/inquiries?page=1&per_page=10" -H "Authorization: Bearer $TOKEN"
```

- [ ] **Step 4: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add inquiry CRUD router with status transitions"
```

---

### Task 5: Settlement Service & Router

**Files:**
- Create: `backend/app/services/settlement_service.py`
- Create: `backend/app/routers/settlements.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create settlement service**

Create `backend/app/services/settlement_service.py`:
```python
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.settlement import Settlement, SettlementStatus
from app.models.inquiry import Inquiry, InquiryStatus


async def calculate_net_profit(revenue: Decimal, vendor_cost: Decimal, other_expenses: Decimal) -> Decimal:
    return revenue - vendor_cost - other_expenses


async def get_finance_stats(db: AsyncSession) -> dict:
    pending = await db.execute(
        select(func.count(Settlement.id)).where(Settlement.status == SettlementStatus.PENDING)
    )
    completed = await db.execute(
        select(func.count(Settlement.id)).where(Settlement.status == SettlementStatus.COMPLETED)
    )
    total_profit = await db.execute(
        select(func.coalesce(func.sum(Settlement.net_profit), 0)).where(
            Settlement.status == SettlementStatus.COMPLETED
        )
    )
    total_revenue = await db.execute(
        select(func.coalesce(func.sum(Settlement.revenue), 0))
    )
    total_vendor_cost = await db.execute(
        select(func.coalesce(func.sum(Settlement.vendor_cost), 0))
    )
    return {
        "pending_settlements": pending.scalar() or 0,
        "completed_settlements": completed.scalar() or 0,
        "total_profit": float(total_profit.scalar() or 0),
        "total_revenue": float(total_revenue.scalar() or 0),
        "total_vendor_cost": float(total_vendor_cost.scalar() or 0),
    }
```

- [ ] **Step 2: Create settlements router**

Create `backend/app/routers/settlements.py`:
```python
import uuid
import math
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
async def list_settlements(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = select(Settlement)
    count_query = select(func.count(Settlement.id))

    if status:
        query = query.where(Settlement.status == status)
        count_query = count_query.where(Settlement.status == status)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Settlement.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    settlements = result.scalars().all()

    return PaginatedResponse(
        items=[SettlementResponse.model_validate(s) for s in settlements],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/summary")
async def settlement_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await get_finance_stats(db)


@router.get("/{settlement_id}", response_model=SettlementResponse)
async def get_settlement(
    settlement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Settlement).where(Settlement.id == settlement_id))
    settlement = result.scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found")
    return SettlementResponse.model_validate(settlement)


@router.get("/event/{inquiry_id}", response_model=SettlementResponse)
async def get_settlement_by_event(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Settlement).where(Settlement.inquiry_id == inquiry_id))
    settlement = result.scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=404, detail="No settlement found for this event")
    return SettlementResponse.model_validate(settlement)


@router.post("", response_model=SettlementResponse, status_code=201)
async def create_settlement(
    data: SettlementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    # Verify inquiry is confirmed
    inquiry_result = await db.execute(select(Inquiry).where(Inquiry.id == data.inquiry_id))
    inquiry = inquiry_result.scalar_one_or_none()
    if inquiry is None:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if inquiry.status != InquiryStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Can only create settlement for confirmed events")

    # Check no existing settlement
    existing = await db.execute(select(Settlement).where(Settlement.inquiry_id == data.inquiry_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Settlement already exists for this event")

    net_profit = await calculate_net_profit(data.revenue, data.vendor_cost, data.other_expenses)

    settlement = Settlement(
        id=uuid.uuid4(),
        inquiry_id=data.inquiry_id,
        revenue=data.revenue,
        vendor_cost=data.vendor_cost,
        other_expenses=data.other_expenses,
        net_profit=net_profit,
        status=SettlementStatus.PENDING,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(settlement)
    await db.flush()
    await db.refresh(settlement)
    return SettlementResponse.model_validate(settlement)


@router.put("/{settlement_id}", response_model=SettlementResponse)
async def update_settlement(
    settlement_id: uuid.UUID,
    data: SettlementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Settlement).where(Settlement.id == settlement_id))
    settlement = result.scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settlement, field, value)

    # Recalculate net profit
    settlement.net_profit = await calculate_net_profit(
        settlement.revenue, settlement.vendor_cost, settlement.other_expenses
    )

    await db.flush()
    await db.refresh(settlement)
    return SettlementResponse.model_validate(settlement)


@router.patch("/{settlement_id}/status")
async def complete_settlement(
    settlement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Settlement).where(Settlement.id == settlement_id))
    settlement = result.scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found")

    settlement.status = SettlementStatus.COMPLETED
    await db.flush()
    return {"message": "Settlement marked as completed"}


@router.get("/export/excel")
async def export_settlements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    from openpyxl import Workbook
    from io import BytesIO

    result = await db.execute(select(Settlement).order_by(Settlement.created_at.desc()))
    settlements = result.scalars().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Settlements"

    headers = ["ID", "Inquiry ID", "Revenue", "Vendor Cost", "Other Expenses", "Net Profit", "Status", "Notes", "Created At"]
    ws.append(headers)

    for s in settlements:
        ws.append([
            str(s.id), str(s.inquiry_id), float(s.revenue), float(s.vendor_cost),
            float(s.other_expenses), float(s.net_profit), s.status.value,
            s.notes or "", s.created_at.isoformat(),
        ])

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=settlements.xlsx"},
    )
```

- [ ] **Step 3: Mount settlements router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers.settlements import router as settlements_router
app.include_router(settlements_router)
```

- [ ] **Step 4: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add settlement CRUD router with Excel export"
```

---

### Task 6: Dashboard Router

**Files:**
- Create: `backend/app/schemas/dashboard.py`
- Create: `backend/app/services/dashboard_service.py`
- Create: `backend/app/routers/dashboard.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create dashboard schemas**

Create `backend/app/schemas/dashboard.py`:
```python
from pydantic import BaseModel


class AdminKPIs(BaseModel):
    total_inquiries: int
    confirmed: int
    cancelled: int
    upcoming_events: int
    today_events: int
    pending_payments: int
    total_revenue: float
    outstanding_amount: float
    pending_kitchen_plans: int
    pending_warehouse_requests: int


class SalesKPIs(BaseModel):
    new_inquiries: int
    followups_today: int
    overdue_followups: int
    confirmed: int
    cancelled: int
    pending_presentations: int
    pending_menus: int
    pending_payments: int
    total_sales_value: float
    conversion_rate: float


class FinanceKPIs(BaseModel):
    pending_settlements: int
    completed_settlements: int
    total_profit: float
    total_revenue: float
    total_vendor_cost: float


class MonthlyTrend(BaseModel):
    month: str
    count: int


class StatusDistribution(BaseModel):
    status: str
    count: int


class FunnelStage(BaseModel):
    stage: str
    count: int


class RevenueMonth(BaseModel):
    month: str
    revenue: float
    profit: float
```

- [ ] **Step 2: Create dashboard service**

Create `backend/app/services/dashboard_service.py`:
```python
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, and_
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus
from app.models.settlement import Settlement, SettlementStatus


async def get_admin_kpis(db: AsyncSession) -> dict:
    today = date.today()

    total = await db.execute(select(func.count(Inquiry.id)))
    confirmed = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CONFIRMED)
    )
    cancelled = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CANCELLED)
    )
    upcoming = await db.execute(
        select(func.count(Inquiry.id)).where(
            Inquiry.event_date >= today,
            Inquiry.status == InquiryStatus.CONFIRMED,
        )
    )
    today_events = await db.execute(
        select(func.count(Inquiry.id)).where(
            Inquiry.event_date == today,
            Inquiry.status == InquiryStatus.CONFIRMED,
        )
    )
    pending_payment = await db.execute(
        select(func.count(Inquiry.id)).where(
            Inquiry.status == InquiryStatus.CONFIRMED,
            Inquiry.payment_status != PaymentStatus.PAID,
        )
    )
    total_revenue = await db.execute(
        select(func.coalesce(func.sum(Inquiry.advance_amount), 0))
    )
    outstanding = await db.execute(
        select(func.coalesce(func.sum(Inquiry.budget - Inquiry.advance_amount), 0)).where(
            Inquiry.status == InquiryStatus.CONFIRMED,
            Inquiry.payment_status != PaymentStatus.PAID,
        )
    )

    return {
        "total_inquiries": total.scalar() or 0,
        "confirmed": confirmed.scalar() or 0,
        "cancelled": cancelled.scalar() or 0,
        "upcoming_events": upcoming.scalar() or 0,
        "today_events": today_events.scalar() or 0,
        "pending_payments": pending_payment.scalar() or 0,
        "total_revenue": float(total_revenue.scalar() or 0),
        "outstanding_amount": float(outstanding.scalar() or 0),
        "pending_kitchen_plans": 0,  # Phase 2
        "pending_warehouse_requests": 0,  # Phase 2
    }


async def get_sales_kpis(db: AsyncSession) -> dict:
    today = date.today()

    new = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.NEW)
    )
    followups_today = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.follow_up_date == today)
    )
    overdue = await db.execute(
        select(func.count(Inquiry.id)).where(
            Inquiry.follow_up_date < today,
            Inquiry.status.in_([InquiryStatus.NEW, InquiryStatus.FOLLOW_UP]),
        )
    )
    confirmed = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CONFIRMED)
    )
    cancelled = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.CANCELLED)
    )
    presentations = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.PRESENTATION_SENT)
    )
    menus = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.status == InquiryStatus.MENU_READY)
    )
    pending_payment = await db.execute(
        select(func.count(Inquiry.id)).where(
            Inquiry.status == InquiryStatus.CONFIRMED,
            Inquiry.payment_status != PaymentStatus.PAID,
        )
    )
    total_sales = await db.execute(
        select(func.coalesce(func.sum(Inquiry.budget), 0)).where(
            Inquiry.status == InquiryStatus.CONFIRMED
        )
    )
    total_inquiries = await db.execute(select(func.count(Inquiry.id)))
    total_count = total_inquiries.scalar() or 0
    confirmed_count = confirmed.scalar() or 0
    conversion_rate = (confirmed_count / total_count * 100) if total_count > 0 else 0

    return {
        "new_inquiries": new.scalar() or 0,
        "followups_today": followups_today.scalar() or 0,
        "overdue_followups": overdue.scalar() or 0,
        "confirmed": confirmed.scalar() or 0,
        "cancelled": cancelled.scalar() or 0,
        "pending_presentations": presentations.scalar() or 0,
        "pending_menus": menus.scalar() or 0,
        "pending_payments": pending_payment.scalar() or 0,
        "total_sales_value": float(total_sales.scalar() or 0),
        "conversion_rate": round(conversion_rate, 1),
    }


async def get_monthly_trend(db: AsyncSession) -> list:
    result = await db.execute(
        select(
            func.to_char(Inquiry.created_at, 'YYYY-MM').label('month'),
            func.count(Inquiry.id).label('count'),
        )
        .group_by('month')
        .order_by('month')
        .limit(12)
    )
    return [{"month": row.month, "count": row.count} for row in result.all()]


async def get_status_distribution(db: AsyncSession) -> list:
    result = await db.execute(
        select(Inquiry.status, func.count(Inquiry.id).label('count'))
        .group_by(Inquiry.status)
    )
    return [{"status": row.status.value, "count": row.count} for row in result.all()]


async def get_sales_funnel(db: AsyncSession) -> list:
    stages = [
        ("Lead", InquiryStatus.NEW),
        ("Follow Up", InquiryStatus.FOLLOW_UP),
        ("Menu Ready", InquiryStatus.MENU_READY),
        ("Presentation Sent", InquiryStatus.PRESENTATION_SENT),
        ("Negotiation", InquiryStatus.NEGOTIATION),
        ("Confirmed", InquiryStatus.CONFIRMED),
    ]
    result = []
    for label, status in stages:
        count_result = await db.execute(
            select(func.count(Inquiry.id)).where(Inquiry.status == status)
        )
        result.append({"stage": label, "count": count_result.scalar() or 0})
    return result
```

- [ ] **Step 3: Create dashboard router**

Create `backend/app/routers/dashboard.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.schemas.dashboard import AdminKPIs, SalesKPIs, FinanceKPIs, MonthlyTrend, StatusDistribution, FunnelStage
from app.middleware.auth import get_current_user, require_role
from app.services.dashboard_service import (
    get_admin_kpis, get_sales_kpis, get_monthly_trend,
    get_status_distribution, get_sales_funnel,
)
from app.services.settlement_service import get_finance_stats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/admin", response_model=AdminKPIs)
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await get_admin_kpis(db)


@router.get("/sales", response_model=SalesKPIs)
async def sales_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "sales_head")),
):
    return await get_sales_kpis(db)


@router.get("/finance", response_model=FinanceKPIs)
async def finance_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await get_finance_stats(db)


@router.get("/charts/monthly-trend")
async def monthly_trend(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_monthly_trend(db)


@router.get("/charts/conversion-rate")
async def conversion_rate(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_status_distribution(db)


@router.get("/charts/sales-funnel")
async def sales_funnel(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_sales_funnel(db)
```

- [ ] **Step 4: Mount dashboard router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers.dashboard import router as dashboard_router
app.include_router(dashboard_router)
```

- [ ] **Step 5: Test dashboard endpoints**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@shaguncatering.com","password":"admin123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl http://localhost:8000/api/dashboard/admin -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/api/dashboard/sales -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/api/dashboard/finance -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/api/dashboard/charts/monthly-trend -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/api/dashboard/charts/sales-funnel -H "Authorization: Bearer $TOKEN"
```

- [ ] **Step 6: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add dashboard router with admin, sales, finance KPIs and charts"
```

---

### Task 7: Notifications Router

**Files:**
- Create: `backend/app/routers/notifications.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create notifications router**

Create `backend/app/routers/notifications.py`:
```python
import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.schemas.common import PaginatedResponse
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=PaginatedResponse[NotificationResponse])
async def list_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Notification).where(Notification.user_id == current_user.id)
    count_query = select(func.count(Notification.id)).where(Notification.user_id == current_user.id)

    if unread_only:
        query = query.where(Notification.is_read == False)
        count_query = count_query.where(Notification.is_read == False)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Notification.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    notifications = result.scalars().all()

    return PaginatedResponse(
        items=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.flush()
    return {"message": "Marked as read"}


@router.patch("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.flush()
    return {"message": "All notifications marked as read"}
```

- [ ] **Step 2: Mount notifications router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers.notifications import router as notifications_router
app.include_router(notifications_router)
```

- [ ] **Step 3: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add notifications router"
```

---

### Task 8: Final Backend Integration Test

**Files:**
- Modify: `backend/tests/test_auth.py`
- Create: `backend/tests/test_inquiries.py`

- [ ] **Step 1: Add inquiry integration tests**

Create `backend/tests/test_inquiries.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def admin_token(client):
    response = await client.post("/api/auth/login", json={
        "email": "admin@shaguncatering.com",
        "password": "admin123",
    })
    return response.json()["access_token"]


@pytest.mark.anyio
async def test_create_inquiry(client, admin_token):
    response = await client.post("/api/inquiries", json={
        "client_name": "Test Family",
        "client_phone": "1234567890",
        "event_type": "birthday",
        "pax": 50,
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 201
    data = response.json()
    assert data["client_name"] == "Test Family"
    assert data["status"] == "new"


@pytest.mark.anyio
async def test_list_inquiries(client, admin_token):
    response = await client.get("/api/inquiries", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.anyio
async def test_dashboard_admin(client, admin_token):
    response = await client.get("/api/dashboard/admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert "total_inquiries" in data
    assert "total_revenue" in data


@pytest.mark.anyio
async def test_finance_summary(client, admin_token):
    response = await client.get("/api/settlements/summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert "pending_settlements" in data
    assert "total_profit" in data
```

- [ ] **Step 2: Run all tests**

```bash
cd D:\Shagun CRM\backend
pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 3: Final commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "test: add integration tests for inquiries, dashboard, settlements"
```

---

## Summary

After completing all 8 tasks, the backend will have:
- **Auth:** Login, logout, /me, JWT access+refresh tokens
- **Users:** Full CRUD (admin only), pagination, search, role filter
- **Inquiries:** Full CRUD, status transitions, payment updates, filtering, pagination
- **Settlements:** Full CRUD, FnF summary, Excel export, status management
- **Dashboard:** Admin KPIs, Sales KPIs, Finance KPIs, monthly trend, conversion rate, sales funnel
- **Notifications:** List, mark read, mark all read
- **Tests:** 10+ integration tests passing
