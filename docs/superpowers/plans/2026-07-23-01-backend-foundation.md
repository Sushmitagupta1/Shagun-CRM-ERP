# Shagun ERP — Plan 1: Backend Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the FastAPI backend with PostgreSQL, SQLAlchemy models, JWT authentication, and seed data — producing a running API server with login capability.

**Architecture:** FastAPI async app with SQLAlchemy 2.0 (asyncpg), Alembic migrations, Pydantic v2 schemas, JWT access+refresh token auth (15min/7day), bcrypt password hashing. Docker PostgreSQL for local dev.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, python-jose, passlib, bcrypt, asyncpg, uvicorn, Docker, PostgreSQL 16

---

## File Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── user.py
│   │   ├── inquiry.py
│   │   ├── settlement.py
│   │   └── activity.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── common.py
│   │   ├── inquiry.py
│   │   └── settlement.py
│   ├── routers/
│   │   ├── __init__.py
│   │   └── auth.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── auth_service.py
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── auth.py
│   └── seed.py
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── alembic.ini
├── requirements.txt
├── Dockerfile
├── .env
└── .env.example
```

---

### Task 1: Initialize Backend Project

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env`
- Create: `backend/.env.example`
- Create: `backend/Dockerfile`
- Create: `backend/app/__init__.py`

- [ ] **Step 1: Create the project directory structure**

Run:
```bash
mkdir -p D:\Shagun CRM\backend\app\models
mkdir -p D:\Shagun CRM\backend\app\schemas
mkdir -p D:\Shagun CRM\backend\app\routers
mkdir -p D:\Shagun CRM\backend\app\services
mkdir -p D:\Shagun CRM\backend\app\middleware
mkdir -p D:\Shagun CRM\backend\alembic\versions
```

- [ ] **Step 2: Create requirements.txt**

Create `backend/requirements.txt`:
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.14.1
pydantic[email]==2.10.4
pydantic-settings==2.7.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
bcrypt==4.2.1
python-multipart==0.0.20
httpx==0.28.1
openpyxl==3.1.5
```

- [ ] **Step 3: Create .env with development defaults**

Create `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://shagun:shagun123@localhost:5432/shagun_erp
JWT_SECRET_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["http://localhost:5173"]
ENVIRONMENT=development
```

- [ ] **Step 4: Create .env.example**

Create `backend/.env.example`:
```
DATABASE_URL=postgresql+asyncpg://shagun:password@localhost:5432/shagun_erp
JWT_SECRET_KEY=replace-with-random-64-char-hex
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["http://localhost:5173"]
ENVIRONMENT=development
```

- [ ] **Step 5: Create Dockerfile**

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 6: Create empty __init__.py files**

Create `backend/app/__init__.py` (empty file).

- [ ] **Step 7: Initialize git and commit**

```bash
cd D:\Shagun CRM\backend
git init
git add .
git commit -m "feat: initialize backend project with dependencies"
```

---

### Task 2: Configuration & Database Setup

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create config.py**

Create `backend/app/config.py`:
```python
from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://shagun:shagun123@localhost:5432/shagun_erp"
    JWT_SECRET_KEY: str = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = '["http://localhost:5173"]'
    ENVIRONMENT: str = "development"

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
```

- [ ] **Step 2: Create database.py**

Create `backend/app/database.py`:
```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.ENVIRONMENT == "development")
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

- [ ] **Step 3: Create initial main.py**

Create `backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(
    title="Shagun Catering ERP API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "shagun-erp"}
```

- [ ] **Step 4: Verify the app starts**

Run from `backend/`:
```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/api/health` — should return `{"status":"ok","service":"shagun-erp"}`.
Open `http://localhost:8000/api/docs` — should show Swagger UI.

- [ ] **Step 5: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add config, database, and health endpoint"
```

---

### Task 3: SQLAlchemy Models

**Files:**
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/inquiry.py`
- Create: `backend/app/models/settlement.py`
- Create: `backend/app/models/activity.py`
- Create: `backend/app/models/__init__.py`
- Modify: `backend/app/database.py`

- [ ] **Step 1: Create base model mixin**

Create `backend/app/models/base.py`:
```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
```

- [ ] **Step 2: Create Role and User models**

Create `backend/app/models/user.py`:
```python
import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class RoleName(str, enum.Enum):
    ADMIN = "admin"
    SALES_HEAD = "sales_head"
    MENU_PLANNER = "menu_planner"
    PRESENTATION_EXEC = "presentation_exec"
    OPERATIONS_MANAGER = "operations_manager"
    KITCHEN = "kitchen"
    WAREHOUSE = "warehouse"
    FINANCE = "finance"


class Role(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    permissions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="role")


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    role: Mapped["Role"] = relationship(back_populates="users")
```

- [ ] **Step 3: Create Inquiry model**

Create `backend/app/models/inquiry.py`:
```python
import uuid
import enum
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import String, Text, Integer, Numeric, ForeignKey, Enum, Date
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class InquiryStatus(str, enum.Enum):
    NEW = "new"
    FOLLOW_UP = "follow_up"
    MENU_READY = "menu_ready"
    PRESENTATION_SENT = "presentation_sent"
    NEGOTIATION = "negotiation"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


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
    pax: Mapped[int | None] = mapped_column(Integer, nullable=True)
    budget: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[InquiryStatus] = mapped_column(
        Enum(InquiryStatus), default=InquiryStatus.NEW, nullable=False
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    advance_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.UNPAID, nullable=False
    )
```

- [ ] **Step 4: Create Settlement model**

Create `backend/app/models/settlement.py`:
```python
import uuid
import enum
from decimal import Decimal
from sqlalchemy import String, Text, Numeric, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class SettlementStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"


class Settlement(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "settlements"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id"), unique=True, nullable=False
    )
    revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    vendor_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    other_expenses: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    net_profit: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    status: Mapped[SettlementStatus] = mapped_column(
        Enum(SettlementStatus), default=SettlementStatus.PENDING, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
```

- [ ] **Step 5: Create ActivityLog model**

Create `backend/app/models/activity.py`:
```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, JSON, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin


class ActivityLog(UUIDMixin, Base):
    __tablename__ = "activity_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
```

- [ ] **Step 6: Create models __init__.py to import all models**

Create `backend/app/models/__init__.py`:
```python
from app.models.user import User, Role, RoleName
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus
from app.models.settlement import Settlement, SettlementStatus
from app.models.activity import ActivityLog

__all__ = [
    "User",
    "Role",
    "RoleName",
    "Inquiry",
    "InquiryStatus",
    "PaymentStatus",
    "Settlement",
    "SettlementStatus",
    "ActivityLog",
]
```

- [ ] **Step 7: Update database.py to import Base correctly**

The `Base` class is already defined in `database.py`. The models import it from there. No change needed — verify by running:
```bash
cd D:\Shagun CRM\backend
python -c "from app.models import User, Role, Inquiry, Settlement, ActivityLog; print('Models imported OK')"
```

- [ ] **Step 8: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add SQLAlchemy models (User, Role, Inquiry, Settlement, ActivityLog)"
```

---

### Task 4: Alembic Migrations

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`

- [ ] **Step 1: Initialize Alembic**

Run from `backend/`:
```bash
alembic init alembic
```

This creates `alembic.ini` and the `alembic/` directory. We'll overwrite the generated files with our async-compatible versions.

- [ ] **Step 2: Update alembic.ini**

Replace `backend/alembic.ini` content with:
```ini
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = postgresql+asyncpg://shagun:shagun123@localhost:5432/shagun_erp

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 3: Create async-compatible env.py**

Replace `backend/alembic/env.py` with:
```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.config import settings
from app.database import Base
from app.models import User, Role, Inquiry, Settlement, ActivityLog  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Create initial migration**

First, start PostgreSQL. From project root:
```bash
cd D:\Shagun CRM
docker run -d --name shagun-postgres -e POSTGRES_DB=shagun_erp -e POSTGRES_USER=shagun -e POSTGRES_PASSWORD=shagun123 -p 5432:5432 postgres:16-alpine
```

Then generate the migration:
```bash
cd D:\Shagun CRM\backend
alembic revision --autogenerate -m "initial tables"
```

- [ ] **Step 5: Apply the migration**

```bash
cd D:\Shagun CRM\backend
alembic upgrade head
```

Verify tables exist:
```bash
docker exec -it shagun-postgres psql -U shagun -d shagun_erp -c "\dt"
```

Expected output should show: `roles`, `users`, `inquiries`, `settlements`, `activity_logs`.

- [ ] **Step 6: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add Alembic migrations for all tables"
```

---

### Task 5: Auth Service (JWT + Password Hashing)

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/auth_service.py`

- [ ] **Step 1: Create services __init__.py**

Create `backend/app/services/__init__.py` (empty file).

- [ ] **Step 2: Create auth_service.py**

Create `backend/app/services/auth_service.py`:
```python
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
```

- [ ] **Step 3: Verify password hashing works**

```bash
cd D:\Shagun CRM\backend
python -c "
from app.services.auth_service import hash_password, verify_password
h = hash_password('test123')
print('Hash:', h)
print('Verify:', verify_password('test123', h))
print('Wrong:', verify_password('wrong', h))
"
```

Expected: Hash printed, `Verify: True`, `Wrong: False`.

- [ ] **Step 4: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add auth service (JWT tokens, password hashing)"
```

---

### Task 6: Auth Schemas

**Files:**
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/schemas/user.py`
- Create: `backend/app/schemas/common.py`

- [ ] **Step 1: Create schemas __init__.py**

Create `backend/app/schemas/__init__.py` (empty file).

- [ ] **Step 2: Create common schemas**

Create `backend/app/schemas/common.py`:
```python
from typing import TypeVar, Generic, List
from pydantic import BaseModel

T = TypeVar("T")


class MessageResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    per_page: int
    total_pages: int
```

- [ ] **Step 3: Create auth schemas**

Create `backend/app/schemas/auth.py`:
```python
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str | None = None  # Optional: can also come from cookie
```

- [ ] **Step 4: Create user schemas**

Create `backend/app/schemas/user.py`:
```python
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: RoleResponse
    is_active: bool
    avatar_url: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role_id: uuid.UUID


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    role_id: uuid.UUID | None = None
    is_active: bool | None = None
```

- [ ] **Step 5: Create inquiry schemas (placeholder — will expand in Plan 3)**

Create `backend/app/schemas/inquiry.py`:
```python
import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel


class InquiryCreate(BaseModel):
    client_name: str
    client_phone: str
    event_type: str
    event_date: date | None = None
    pax: int | None = None
    budget: Decimal | None = None
    assigned_to: uuid.UUID | None = None
    follow_up_date: date | None = None
    remarks: str | None = None


class InquiryUpdate(BaseModel):
    client_name: str | None = None
    client_phone: str | None = None
    event_type: str | None = None
    event_date: date | None = None
    pax: int | None = None
    budget: Decimal | None = None
    assigned_to: uuid.UUID | None = None
    follow_up_date: date | None = None
    remarks: str | None = None


class InquiryResponse(BaseModel):
    id: uuid.UUID
    client_name: str
    client_phone: str
    event_type: str
    event_date: date | None
    pax: int | None
    budget: Decimal | None
    status: str
    assigned_to: uuid.UUID | None
    created_by: uuid.UUID
    follow_up_date: date | None
    remarks: str | None
    advance_amount: Decimal
    payment_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 6: Create settlement schemas (placeholder — will expand in Plan 4)**

Create `backend/app/schemas/settlement.py`:
```python
import uuid
from decimal import Decimal
from pydantic import BaseModel


class SettlementCreate(BaseModel):
    inquiry_id: uuid.UUID
    revenue: Decimal
    vendor_cost: Decimal = Decimal("0")
    other_expenses: Decimal = Decimal("0")
    notes: str | None = None


class SettlementUpdate(BaseModel):
    revenue: Decimal | None = None
    vendor_cost: Decimal | None = None
    other_expenses: Decimal | None = None
    notes: str | None = None


class SettlementResponse(BaseModel):
    id: uuid.UUID
    inquiry_id: uuid.UUID
    revenue: Decimal
    vendor_cost: Decimal
    other_expenses: Decimal
    net_profit: Decimal
    status: str
    notes: str | None
    created_by: uuid.UUID
    created_at: str

    class Config:
        from_attributes = True
```

- [ ] **Step 7: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add Pydantic schemas (auth, user, inquiry, settlement, common)"
```

---

### Task 7: Auth Middleware & Router

**Files:**
- Create: `backend/app/middleware/__init__.py`
- Create: `backend/app/middleware/auth.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create middleware __init__.py**

Create `backend/app/middleware/__init__.py` (empty file).

- [ ] **Step 2: Create auth middleware**

Create `backend/app/middleware/auth.py`:
```python
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.services.auth_service import decode_token
from app.models.user import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


def require_role(*allowed_roles: str):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No role assigned",
            )
        # We need to check role name, but we have role_id
        # For simplicity, we'll load the role in the dependency
        from sqlalchemy import select
        from app.models.user import Role
        from app.database import async_session_factory

        async with async_session_factory() as db:
            result = await db.execute(select(Role).where(Role.id == current_user.role_id))
            role = result.scalar_one_or_none()
            if role is None or role.name not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role '{role.name if role else 'none'}' not authorized. Required: {allowed_roles}",
                )
        return current_user
    return role_checker
```

- [ ] **Step 3: Create routers __init__.py**

Create `backend/app/routers/__init__.py` (empty file).

- [ ] **Step 4: Create auth router**

Create `backend/app/routers/auth.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services.auth_service import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token_data = {"sub": str(user.id), "role_id": str(user.role_id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set True in production with HTTPS
        samesite="lax",
        max_age=7 * 24 * 60 * 60,  # 7 days
    )

    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(response: Response, db: AsyncSession = Depends(get_db)):
    # In a real implementation, read from cookie
    # For now, this is a placeholder — the frontend will handle token refresh
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Refresh endpoint — implement with cookie reading",
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="refresh_token")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
```

- [ ] **Step 5: Update main.py to mount auth router**

Replace `backend/app/main.py` with:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers.auth import router as auth_router

app = FastAPI(
    title="Shagun Catering ERP API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "shagun-erp"}
```

- [ ] **Step 6: Test the login endpoint**

Start the server:
```bash
cd D:\Shagun CRM\backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Test login (will fail until we seed — that's next):
```bash
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@shaguncatering.com\",\"password\":\"admin123\"}"
```

Expected: 401 (user doesn't exist yet).

- [ ] **Step 7: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add auth middleware and login/logout endpoints"
```

---

### Task 8: Seed Data

**Files:**
- Create: `backend/app/seed.py`

- [ ] **Step 1: Create seed script**

Create `backend/app/seed.py`:
```python
import asyncio
import uuid
from app.database import async_session_factory, engine, Base
from app.models.user import Role, User, RoleName
from app.services.auth_service import hash_password

ROLES = [
    {"name": RoleName.ADMIN, "permissions": {"all": True}},
    {"name": RoleName.SALES_HEAD, "permissions": {"inquiries": ["read", "write", "update"], "dashboard": ["sales"]}},
    {"name": RoleName.MENU_PLANNER, "permissions": {"menus": ["read", "write"], "inquiries": ["read"]}},
    {"name": RoleName.PRESENTATION_EXEC, "permissions": {"presentations": ["read", "write"], "inquiries": ["read"]}},
    {"name": RoleName.OPERATIONS_MANAGER, "permissions": {"events": ["read", "write"], "vendors": ["read", "write"], "warehouse": ["read", "write"]}},
    {"name": RoleName.KITCHEN, "permissions": {"kitchen": ["read", "write"], "inquiries": ["read"]}},
    {"name": RoleName.WAREHOUSE, "permissions": {"inventory": ["read", "write"], "warehouse": ["read", "write"]}},
    {"name": RoleName.FINANCE, "permissions": {"settlements": ["read", "write", "export"], "finance": ["read"]}},
]

DEFAULT_ADMIN = {
    "email": "admin@shaguncatering.com",
    "password": "admin123",
    "full_name": "Admin",
}


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        # Check if roles already exist
        from sqlalchemy import select
        result = await session.execute(select(Role).limit(1))
        if result.scalar_one_or_none() is not None:
            print("Database already seeded. Skipping.")
            return

        # Create roles
        role_map = {}
        for role_data in ROLES:
            role = Role(id=uuid.uuid4(), name=role_data["name"], permissions=role_data["permissions"])
            session.add(role)
            role_map[role_data["name"]] = role

        await session.flush()

        # Create default admin
        admin_role = role_map[RoleName.ADMIN]
        admin = User(
            id=uuid.uuid4(),
            email=DEFAULT_ADMIN["email"],
            password_hash=hash_password(DEFAULT_ADMIN["password"]),
            full_name=DEFAULT_ADMIN["full_name"],
            role_id=admin_role.id,
            is_active=True,
        )
        session.add(admin)

        await session.commit()
        print("Seed complete!")
        print(f"  Admin: {DEFAULT_ADMIN['email']} / {DEFAULT_ADMIN['password']}")
        print(f"  Roles created: {[r.value for r in RoleName]}")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 2: Run the seed script**

```bash
cd D:\Shagun CRM\backend
python -m app.seed
```

Expected output:
```
Seed complete!
  Admin: admin@shaguncatering.com / admin123
  Roles created: ['admin', 'sales_head', 'menu_planner', 'presentation_exec', 'operations_manager', 'kitchen', 'warehouse', 'finance']
```

- [ ] **Step 3: Test login with seeded admin**

```bash
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@shaguncatering.com\",\"password\":\"admin123\"}"
```

Expected: `{"access_token":"eyJ...","token_type":"bearer"}`

- [ ] **Step 4: Test /me endpoint**

Copy the access_token from above, then:
```bash
curl http://localhost:8000/api/auth/me -H "Authorization: Bearer <token>"
```

Expected: User JSON with email, full_name, role.

- [ ] **Step 5: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: add seed script with roles and default admin user"
```

---

### Task 9: Backend Integration Test

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Create test directory and files**

```bash
mkdir -p D:\Shagun CRM\backend\tests
```

Create `backend/tests/__init__.py` (empty file).

- [ ] **Step 2: Write auth integration test**

Create `backend/tests/test_auth.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.anyio
async def test_health(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.anyio
async def test_login_success(client):
    response = await client.post("/api/auth/login", json={
        "email": "admin@shaguncatering.com",
        "password": "admin123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.anyio
async def test_login_wrong_password(client):
    response = await client.post("/api/auth/login", json={
        "email": "admin@shaguncatering.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


@pytest.mark.anyio
async def test_login_nonexistent_user(client):
    response = await client.post("/api/auth/login", json={
        "email": "nobody@example.com",
        "password": "test123",
    })
    assert response.status_code == 401


@pytest.mark.anyio
async def test_me_with_valid_token(client):
    login_resp = await client.post("/api/auth/login", json={
        "email": "admin@shaguncatering.com",
        "password": "admin123",
    })
    token = login_resp.json()["access_token"]

    me_resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    data = me_resp.json()
    assert data["email"] == "admin@shaguncatering.com"


@pytest.mark.anyio
async def test_me_without_token(client):
    response = await client.get("/api/auth/me")
    assert response.status_code == 403  # No authorization header
```

- [ ] **Step 3: Install test dependencies and run tests**

```bash
cd D:\Shagun CRM\backend
pip install pytest pytest-asyncio anyio httpx
pytest tests/ -v
```

Expected: All 6 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "test: add auth integration tests"
```

---

## Summary

After completing all 9 tasks, the backend will have:
- FastAPI app running on port 8000
- PostgreSQL with 5 tables (roles, users, inquiries, settlements, activity_logs)
- 8 seeded roles + default admin user
- JWT login/logout with access + refresh tokens
- Protected `/api/auth/me` endpoint
- 6 passing integration tests
- Swagger docs at `/api/docs`
