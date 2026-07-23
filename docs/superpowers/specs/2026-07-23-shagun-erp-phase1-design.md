# Shagun Catering ERP — Phase 1 Design Spec

## Overview

Phase 1 delivers the core ERP foundation: JWT authentication with role-based access, the Admin dashboard (including Finance/Settlement view), the Sales Head dashboard, and a full inquiry management pipeline. The design system (colors, typography, spacing, components) is implemented in this phase and reused across all future phases.

**In scope:** Auth, Admin dashboard (with embedded Finance/Settlement section), Sales Head (Vinod) dashboard, Inquiry CRUD + status pipeline, Settlements tracking (revenue, vendor cost, expenses, net profit per event), layout shell (sidebar, top nav, canvas), design system in Tailwind, PostgreSQL via Docker, seeded roles + admin user.

**Out of scope (Phase 2+):** Menu Planner, Presentation, Operations, Kitchen, Warehouse dashboards as separate pages. AI features, Google Drive, PWA, dark mode, calendar, real-time notifications, PDF export, Celery/Redis background tasks.

---

## 1. Project Structure

```
D:\Shagun CRM\
├── frontend/                    # React 19 + Vite + TypeScript + Tailwind + Shadcn
├── backend/                     # FastAPI + SQLAlchemy + Alembic
├── docker-compose.yml           # PostgreSQL, Redis (optional), Nginx
├── nginx/                       # Reverse proxy config
│   └── default.conf
├── .env.example                 # Shared environment template
└── README.md
```

Monorepo. Single repository, `frontend/` and `backend/` folders, one `docker-compose.yml`.

---

## 2. Backend Architecture

### 2.1 Tech Stack

- FastAPI (async)
- SQLAlchemy 2.0 (async with asyncpg)
- Alembic (migrations)
- Pydantic v2 (schemas)
- Passlib + bcrypt (password hashing)
- python-jose (JWT)
- uvicorn (ASGI server)
- Docker PostgreSQL

### 2.2 File Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app, CORS, mount routers
│   ├── config.py               # Settings from env vars (pydantic-settings)
│   ├── database.py             # SQLAlchemy async engine + session factory
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py             # User, Role models
│   │   ├── inquiry.py          # Inquiry model + StatusEnum
│   │   ├── settlement.py       # Settlement model (FnF per event)
│   │   └── activity.py         # ActivityLog model
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py             # LoginRequest, TokenResponse, RefreshRequest
│   │   ├── user.py             # UserCreate, UserUpdate, UserResponse, RoleResponse
│   │   ├── inquiry.py          # InquiryCreate, InquiryUpdate, InquiryResponse, InquiryListParams
│   │   ├── settlement.py       # SettlementCreate, SettlementUpdate, SettlementResponse, FnFSummary
│   │   ├── dashboard.py        # AdminKPIs, SalesKPIs, FinanceKPIs, ChartData
│   │   └── common.py           # PaginatedResponse, MessageResponse
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py             # POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/logout
│   │   ├── users.py            # GET/POST/PUT/DELETE /api/users
│   │   ├── inquiries.py        # GET/POST/PUT/PATCH /api/inquiries, status transitions
│   │   ├── settlements.py      # GET/POST/PUT /api/settlements, FnF summary per event
│   │   ├── dashboard.py        # GET /api/dashboard/admin, GET /api/dashboard/sales, GET /api/dashboard/finance
│   │   └── notifications.py    # GET /api/notifications, PATCH /api/notifications/{id}/read
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py     # create_tokens, verify_password, refresh_access_token
│   │   ├── inquiry_service.py  # Status transitions, filtering, aggregation
│   │   ├── settlement_service.py # FnF calculations, profit/loss per event
│   │   └── dashboard_service.py # KPI calculations, chart data assembly
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── auth.py             # get_current_user dependency, require_role dependency
│   └── seed.py                 # Seed roles + default admin user
├── alembic/
│   ├── versions/
│   └── env.py
├── alembic.ini
├── requirements.txt
├── Dockerfile
└── .env
```

### 2.3 Data Models

#### Roles
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | VARCHAR(50) | Unique: admin, sales_head, menu_planner, presentation_exec, operations_manager, kitchen, warehouse, finance |
| permissions | JSONB | Array of permission strings |
| created_at | TIMESTAMP | |

#### Users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Unique, indexed |
| password_hash | VARCHAR(255) | bcrypt hash |
| full_name | VARCHAR(100) | |
| role_id | UUID FK | References roles.id |
| is_active | BOOLEAN | Default true |
| avatar_url | VARCHAR(500) | Nullable |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### Inquiries
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| client_name | VARCHAR(200) | Required |
| client_phone | VARCHAR(20) | Required |
| event_type | VARCHAR(100) | wedding, birthday, corporate, etc. |
| event_date | DATE | |
| pax | INTEGER | Guest count |
| budget | DECIMAL(12,2) | |
| status | ENUM | new, follow_up, menu_ready, presentation_sent, negotiation, confirmed, cancelled |
| assigned_to | UUID FK | References users.id (sales head) |
| created_by | UUID FK | References users.id |
| follow_up_date | DATE | Nullable |
| remarks | TEXT | Nullable |
| advance_amount | DECIMAL(12,2) | Default 0, set after confirmation |
| payment_status | ENUM | unpaid, partial, paid. Default unpaid |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### Activity_Logs
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID FK | References users.id |
| action | VARCHAR(100) | created, updated, status_changed, etc. |
| entity_type | VARCHAR(50) | inquiry, user, etc. |
| entity_id | UUID | |
| details | JSONB | |
| created_at | TIMESTAMP | |

#### Settlements (FnF per Event)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| inquiry_id | UUID FK | References inquiries.id (confirmed events only) |
| revenue | DECIMAL(12,2) | Total amount received from customer |
| vendor_cost | DECIMAL(12,2) | Total cost paid to vendors |
| other_expenses | DECIMAL(12,2) | Miscellaneous costs (transport, labor, etc.) |
| net_profit | DECIMAL(12,2) | revenue - vendor_cost - other_expenses (computed or stored) |
| status | ENUM | pending, completed. Default pending |
| notes | TEXT | Nullable, internal notes |
| created_by | UUID FK | References users.id (admin) |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 2.4 API Endpoints

#### Auth
- `POST /api/auth/login` — Email + password → access token (15min) + refresh token (7 days, httpOnly cookie)
- `POST /api/auth/refresh` — Refresh cookie → new access token
- `POST /api/auth/logout` — Clear refresh cookie

#### Users (admin only)
- `GET /api/users` — List all users (paginated, filterable by role)
- `GET /api/users/{id}` — Get user by ID
- `POST /api/users` — Create user (name, email, password, role)
- `PUT /api/users/{id}` — Update user
- `DELETE /api/users/{id}` — Soft delete (set is_active=false)

#### Inquiries
- `GET /api/inquiries` — List inquiries (paginated, filterable by status, assigned_to, date range, search)
- `GET /api/inquiries/{id}` — Get inquiry detail
- `POST /api/inquiries` — Create inquiry (any authenticated user)
- `PUT /api/inquiries/{id}` — Update inquiry fields
- `PATCH /api/inquiries/{id}/status` — Transition status (with validation)
- `PATCH /api/inquiries/{id}/payment` — Update payment status + amount

#### Dashboard
- `GET /api/dashboard/admin` — Aggregated KPIs (total inquiries, confirmed, cancelled, upcoming, today's events, pending payments, total revenue, outstanding)
- `GET /api/dashboard/sales` — Sales KPIs (new inquiries, follow-ups today, overdue, confirmed, cancelled, conversion rate, total sales value)
- `GET /api/dashboard/finance` — Finance KPIs (pending settlements, completed settlements, total profit, total revenue, total vendor cost)
- `GET /api/dashboard/charts/monthly-trend` — Monthly inquiry counts (12 months)
- `GET /api/dashboard/charts/conversion-rate` — Inquiry status distribution
- `GET /api/dashboard/charts/sales-funnel` — Funnel data (lead → menu_ready → presentation → negotiation → confirmed)
- `GET /api/dashboard/charts/revenue-trend` — Monthly revenue + profit (12 months)

#### Settlements (admin only)
- `GET /api/settlements` — List all settlements (paginated, filterable by status, date range)
- `GET /api/settlements/{id}` — Get settlement detail with inquiry + vendor breakdown
- `GET /api/settlements/event/{inquiry_id}` — Get settlement for a specific event
- `POST /api/settlements` — Create settlement for a confirmed event (revenue, vendor_cost, other_expenses, notes)
- `PUT /api/settlements/{id}` — Update settlement (edit costs, notes)
- `PATCH /api/settlements/{id}/status` — Mark as completed
- `GET /api/settlements/summary` — Aggregated summary (total profit, pending count, completed count)
- `GET /api/settlements/export` — Export settlements as Excel (OpenPyXL)

#### Notifications
- `GET /api/notifications` — List user's notifications (paginated)
- `PATCH /api/notifications/{id}/read` — Mark as read
- `PATCH /api/notifications/read-all` — Mark all as read

### 2.5 Authentication Flow

1. User submits email + password to `POST /api/auth/login`
2. Backend verifies credentials, generates access token (JWT, 15min expiry) and refresh token (JWT, 7 day expiry)
3. Access token returned in JSON response body. Refresh token set as httpOnly secure cookie.
4. Frontend stores access token in memory (or Zustand). Attaches `Authorization: Bearer <token>` to all requests.
5. When access token expires (401 response), frontend calls `POST /api/auth/refresh` with the refresh cookie.
6. Backend verifies refresh token, returns new access token.
7. On logout, frontend calls `POST /api/auth/logout` which clears the refresh cookie.

### 2.6 Role-Based Access

Each route uses a `require_role()` dependency that checks the JWT's role claim against allowed roles. The sidebar menu items are filtered on the frontend based on the user's role.

**Phase 1 role permissions:**
- **admin:** Full access to everything. Can create users. Full access to Finance/Settlements (create, edit, complete, export).
- **sales_head:** Can view/create/update inquiries, view own dashboard, view all inquiries.

---

## 3. Frontend Architecture

### 3.1 Tech Stack

- React 19
- TypeScript (strict mode)
- Vite 6
- Tailwind CSS 4
- Shadcn/UI (New York style, customized with design tokens)
- React Router v7
- TanStack Query v5 (server state)
- Zustand (client state: auth)
- React Hook Form + Zod (forms)
- Recharts (charts)
- TanStack Table (data tables)
- Lucide Icons + React Icons
- Sonner (toast notifications)
- Day.js (dates)
- Axios (HTTP client)
- Framer Motion (animations)

### 3.2 File Structure

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx                     # Router + auth guard
│   ├── index.css                   # Tailwind imports + custom fonts
│   ├── api/
│   │   ├── client.ts               # Axios instance, interceptors (auth, refresh)
│   │   ├── auth.ts                 # login(), refresh(), logout()
│   │   ├── users.ts                # CRUD users
│   │   ├── inquiries.ts            # CRUD inquiries, status transitions
│   │   ├── settlements.ts          # CRUD settlements, FnF summary, export
│   │   ├── dashboard.ts            # KPI data, chart data
│   │   └── notifications.ts        # List, mark-read
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx         # 240px maroon sidebar, gold active pill
│   │   │   ├── TopNav.tsx          # 60px white top bar, search, profile chip
│   │   │   ├── DashboardLayout.tsx # Shell: sidebar + topnav + canvas
│   │   │   └── AuthLayout.tsx      # Centered login card layout
│   │   ├── ui/                     # Shadcn components (Button, Card, Input, Select, etc.)
│   │   ├── charts/
│   │   │   ├── InquiryTrend.tsx    # Bar chart — monthly inquiry volume
│   │   │   ├── ConversionRate.tsx  # Donut chart — status distribution
│   │   │   ├── SalesFunnel.tsx     # Funnel chart — lead to confirmed
│   │   │   ├── RevenueChart.tsx    # Line/bar chart — monthly revenue
│   │   │   └── ProfitChart.tsx     # Bar chart — monthly profit (revenue vs cost)
│   │   ├── tables/
│   │   │   ├── InquiryTable.tsx    # TanStack Table — inquiry list
│   │   │   ├── UserTable.tsx       # TanStack Table — user list (admin)
│   │   │   └── SettlementTable.tsx # TanStack Table — FnF settlements list
│   │   └── common/
│   │       ├── KPICard.tsx         # Metric card (label, value, trend)
│   │       ├── StatusPill.tsx      # Colored pill (success/warning/danger/info)
│   │       ├── SearchBar.tsx       # Pill-shaped search input
│   │       ├── NotificationBell.tsx # Bell icon with red badge
│   │       ├── ProfileChip.tsx     # Avatar + name + role
│   │       ├── PageHeader.tsx      # Page title + optional action button
│   │       ├── EmptyState.tsx      # "No data" placeholder
│   │       └── SettlementForm.tsx  # React Hook Form for create/edit settlement
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── NotFound.tsx
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx  # KPIs + charts + user table + inquiry table
│   │   │   ├── UserManagement.tsx  # User CRUD (admin only)
│   │   │   └── FinancePage.tsx     # Settlements KPIs + FnF table + export
│   │   ├── sales/
│   │   │   └── SalesDashboard.tsx  # KPIs + funnel + follow-ups + inquiry table
│   │   └── inquiries/
│   │       ├── InquiryList.tsx     # Full inquiry list with filters
│   │       ├── InquiryDetail.tsx   # Single inquiry view + edit
│   │       └── InquiryForm.tsx     # Create/edit inquiry form (React Hook Form)
│   ├── hooks/
│   │   ├── useAuth.ts              # Auth state + login/logout actions
│   │   ├── useInquiries.ts         # TanStack Query hooks for inquiries
│   │   ├── useSettlements.ts       # TanStack Query hooks for settlements
│   │   ├── useDashboard.ts         # TanStack Query hooks for dashboard data
│   │   └── useDebounce.ts          # Debounce for search
│   ├── store/
│   │   └── authStore.ts            # Zustand: user, token, role, login/logout
│   ├── types/
│   │   ├── auth.ts                 # LoginRequest, TokenResponse, User
│   │   ├── inquiry.ts              # Inquiry, InquiryStatus, InquiryCreate
│   │   ├── settlement.ts           # Settlement, SettlementCreate, FnFSummary, SettlementStatus
│   │   ├── dashboard.ts            # KPI types, ChartData, FinanceKPIs
│   │   └── common.ts               # PaginatedResponse, ApiResponse
│   ├── lib/
│   │   ├── constants.ts            # Status labels, role labels, colors
│   │   ├── utils.ts                # cn(), formatDate(), formatCurrency()
│   │   └── validators.ts           # Zod schemas (login, inquiry form, settlement form)
│   └── routes/
│       ├── index.tsx               # Route definitions
│       └── ProtectedRoute.tsx      # Auth guard + role check
├── components.json                 # Shadcn config
├── tailwind.config.ts              # Design tokens
├── postcss.config.js
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── package.json
├── Dockerfile
└── .env
```

### 3.3 Pages & Layout

#### Login Page
- Centered card on cream background
- Company logo (Playfair Display, gold) + "CATERING & EVENTS" subtitle
- Email + password fields (React Hook Form + Zod)
- Gold CTA button ("Sign In")
- Error toast via Sonner

#### Dashboard Layout (all authenticated pages)
- Left sidebar (240px, fixed, maroon gradient)
- Top nav (60px, fixed, white, bottom border)
- Main canvas (cream `#FAFAF7`, padding 24px, scrollable)

#### Sidebar Menu Items (Phase 1)
- **All roles:** Dashboard, Inquiries, Calendar (placeholder), Notifications
- **Admin only:** User Management, Finance & Settlements, Reports (placeholder), System Settings (placeholder)
- **Sales Head:** My Pipeline, Follow-ups

#### Admin Dashboard
- **Top row:** 10 KPI cards (grid-cols-5, 2 rows) — Total Inquiries, Confirmed, Cancelled, Upcoming Events, Today's Events, Pending Payments, Total Revenue, Outstanding Amount, Pending Kitchen Plans, Pending Warehouse Requests
- **Middle row:** 3 chart cards (col-span-4 each) — Monthly Inquiry Trend (bar), Inquiry Conversion Rate (donut), Monthly Revenue (bar)
- **Bottom row:** 2 tables (col-span-6 each) — Recent Inquiries table, Pending User Approvals
- **Finance Section (collapsible/tab below or dedicated Finance page for admin):**
  - **Finance KPI row:** 5 cards (grid-cols-5) — Pending Settlements, Completed Settlements, Total Profit, Total Revenue, Total Vendor Cost
  - **FnF Summary table (full-width):** Columns: Event Name, Client, Event Date, Revenue, Vendor Cost, Other Expenses, Net Profit, Status (pill), Actions (view/edit)
  - **Quick Actions:** Export Settlements (Excel download button)
  - **Settlement Detail Modal/Page:** Edit form for revenue, vendor_cost, other_expenses, notes with Save/Complete buttons

#### Sales Head (Vinod) Dashboard
- **Top row:** 10 KPI cards (grid-cols-5, 2 rows) — New Inquiries, Follow-ups Today, Overdue Follow-ups, Confirmed, Cancelled, Pending Presentations, Pending Menus, Pending Payments, Total Sales Value, Conversion Rate
- **Middle row:** 3 widgets (col-span-4 each) — Sales Funnel, Follow-up Widget (today/overdue/next 7 days), Payment Widget
- **Bottom row:** Full-width inquiry table with columns: Client Name, Phone, Event Type, Pax, Event Date, Follow-up Date, Status (pill), Payment Status (pill), Actions

### 3.4 Design System Implementation

#### Tailwind Config (custom colors)
```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: '#5A0016',
          dark: '#3D000F',
        },
        gold: {
          DEFAULT: '#D97706',
          light: '#CCA052',
          hover: '#B46104',
        },
        cream: '#FAFAF7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        brand: ['Playfair Display', 'serif'],
      },
    },
  },
}
```

#### Status Pill Component
```
Success (confirmed/paid):     bg-emerald-100 text-emerald-800
Warning (pending/negotiation): bg-amber-100 text-amber-800
Danger (cancelled/overdue):    bg-rose-100 text-rose-800
Info (new/planning):           bg-blue-100 text-blue-800
```

#### KPI Card Component
- Height: 90-105px, white bg, rounded-xl, subtle shadow
- Top: Label (13px, grey, uppercase, medium)
- Middle: Value (24-26px, bold, slate-900)
- Bottom: Trend indicator (arrow + percentage, green/red)

#### Table Component
- White bg, rounded-xl, overflow hidden
- Header: bg-gray-50, 11px bold uppercase, grey text
- Rows: 48-52px height, border-bottom, hover:bg-gray-50
- Status pills inline in cells

---

## 4. Docker & Deployment

### docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: shagun_erp
      POSTGRES_USER: shagun
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on: [frontend, backend]

  frontend:
    build: ./frontend
    # Served by Nginx in production

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://shagun:${DB_PASSWORD}@postgres:5432/shagun_erp
    depends_on: [postgres]

volumes:
  pgdata:
```

### Nginx Config
- `/` → Frontend (static files)
- `/api` → Backend (proxy_pass to uvicorn:8000)
- SSL via Let's Encrypt (Phase 2)

---

## 5. Seed Data

On first run (or via `python -m app.seed`), create:

**Roles (8):**
1. admin — full access
2. sales_head — inquiry CRUD, sales dashboard
3. menu_planner — menu management
4. presentation_exec — presentations
5. operations_manager — event execution
6. kitchen — kitchen plans
7. warehouse — inventory
8. finance — settlements

**Default Admin User:**
- Email: admin@shaguncatering.com
- Password: admin123
- Role: admin

---

## 6. Environment Variables

```env
# Backend
DATABASE_URL=postgresql+asyncpg://shagun:password@localhost:5432/shagun_erp
JWT_SECRET_KEY=<random-64-char-hex>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["http://localhost:5173"]

# Frontend
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## 7. Validation

- **Backend:** Pydantic schemas validate all request/response bodies. Email format, password strength (min 6 chars), required fields enforced.
- **Frontend:** Zod schemas mirror backend validation. React Hook Form displays inline errors.
- **Inquiry status transitions:** Only valid transitions allowed (e.g., cannot go from cancelled to confirmed directly).
