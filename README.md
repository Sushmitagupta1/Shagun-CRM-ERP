# Shagun Catering ERP

A full-stack, role-based Enterprise Resource Planning system built for **Shagun Catering & Events**. Manages the complete event lifecycle — from inquiry capture to menu planning, presentation design, kitchen production, warehouse dispatch, and final settlement.

![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript_6-3178C6?style=flat&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

---

## Features

### 7 Role-Based Dashboards
Each role sees a personalized dashboard with relevant KPIs, tasks, and AI tools:

| Dashboard | Role | Key Features |
|-----------|------|-------------|
| **Admin** | `admin` | 10 KPIs, monthly trend chart, conversion funnel, AI Reports, AI Insights, AI Chat |
| **Sales** | `sales_head` | Pipeline funnel, follow-up tracker, client reminders, AI Cost Estimation, AI Chat |
| **Menu Planner** | `menu_planner` | AI Menu Generator, menu templates, menus-to-prepare list, AI Chat |
| **Presentation** | `presentation_exec` | Meeting schedule, pipeline tracker, theme library, AI Design Assistant |
| **Operations** | `operations_manager` | Event pipeline, schedule view, vendor tracking, confirmed events |
| **Kitchen** | `kitchen` | Production schedule, ingredient lists, semi-finished items |
| **Warehouse** | `warehouse` | Dispatch tracker, low-stock alerts, recent activity log |

### Inquiry Workflow Pipeline
Full event lifecycle management with role-based sections:

```
New → Follow Up → Menu + Presentation (parallel) → Confirmed → Event → Completed
```

- **Sales** creates inquiries, assigns to Menu Planner + Presentation Exec simultaneously
- **Menu Planner** creates menus, **Presentation Exec** creates presentations (parallel tracks)
- **Sales** follows up → confirms deal → inquiry becomes an **Event**
- **Operations** coordinates between Kitchen and Warehouse
- **Kitchen** receives menu + uploads ingredient lists
- **Warehouse** dispatches items + tracks returns
- **Admin** sees aggregated reports

### AI-Powered Tools (Google Gemini 2.0 Flash)

| Tool | Available On | Description |
|------|-------------|-------------|
| AI Menu Generator | Menu Planner | Generate complete menus with dishes, pricing, dietary info |
| AI Cost Estimation | Sales | Estimate event costs based on guest count and preferences |
| AI Reports | Admin | Generate natural language business summaries |
| AI Insights | Admin, Sales | Get actionable recommendations from data |
| AI Chat | All (role-aware) | Context-aware assistant per dashboard |
| Design Assistant | Presentation | AI-powered presentation and theme suggestions |

### Common Features
- **Authentication:** JWT (15-min access + 7-day httpOnly refresh token)
- **Role-Based Routing:** Automatic redirect to role-specific home page
- **Notifications:** Role-filtered bell dropdown + dedicated notifications page
- **Calendar:** Full month grid view
- **Search:** Global search bar in TopNav
- **Mobile Responsive:** Collapsible sidebar with hamburger menu on mobile
- **Framer Motion Animations:** Staggered card entry, spring sidebar indicators, hover lifts

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| TypeScript | ~6.0 | Type safety |
| Vite | 8 | Build tool + dev server |
| Tailwind CSS | 4 | Utility-first styling |
| React Router | 7 | Client-side routing |
| TanStack Query | 5 | Server state management |
| Zustand | 5 | Client state management |
| React Hook Form + Zod | 4 | Form validation |
| Recharts | 3 | Charts and data visualization |
| Axios | — | HTTP client |
| Framer Motion | 12 | Animations |
| Sonner | 2 | Toast notifications |
| Lucide React | — | Icons |
| Google Gemini API | 2.0 Flash | AI features |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | 0.115 | Async REST API framework |
| SQLAlchemy | 2.0 | ORM (asyncpg driver) |
| Alembic | 1.14 | Database migrations |
| Pydantic | 2.10 | Data validation + settings |
| python-jose | 3.3 | JWT token handling |
| Passlib + bcrypt | 1.7 / 4.2 | Password hashing |
| Uvicorn | 0.34 | ASGI server |
| openpyxl | 3.1 | Excel export (settlements) |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| PostgreSQL 16 | Primary database |
| Nginx | Reverse proxy + static file serving |
| Docker Compose | Multi-container orchestration |

---

## Project Structure

```
shagun-catering-erp/
├── frontend/                    # React 19 + Vite application
│   ├── src/
│   │   ├── api/                 # Axios client + API functions
│   │   │   ├── auth.ts          # Login, logout, refresh, me
│   │   │   ├── client.ts        # Axios instance with interceptors
│   │   │   ├── inquiries.ts     # Inquiry CRUD
│   │   │   ├── users.ts         # User management CRUD
│   │   │   ├── settlements.ts   # Settlement endpoints
│   │   │   ├── dashboard.ts     # Dashboard stats per role
│   │   │   └── notifications.ts # Notification endpoints
│   │   ├── components/
│   │   │   ├── common/          # KPICard, StatusPill, PageHeader, Skeleton
│   │   │   ├── layout/          # Sidebar, TopNav, DashboardLayout
│   │   │   ├── charts/          # Reusable chart components
│   │   │   └── ui/              # Base UI primitives
│   │   ├── hooks/               # useAuth custom hook
│   │   ├── lib/                 # Utilities, constants, Gemini service, notifications data
│   │   ├── pages/               # All page components
│   │   │   ├── admin/           # AdminDashboard, UserManagement, Finance, Reports, Settings
│   │   │   ├── sales/           # SalesDashboard
│   │   │   ├── menu/            # MenuPlannerDashboard
│   │   │   ├── presentation/    # PresentationDashboard
│   │   │   ├── operations/      # OperationsDashboard
│   │   │   ├── kitchen/         # KitchenDashboard
│   │   │   ├── warehouse/       # WarehouseDashboard
│   │   │   └── inquiries/       # InquiryList, InquiryDetail, InquiryForm
│   │   ├── routes/              # Route definitions + ProtectedRoute
│   │   ├── store/               # Zustand stores (auth, sidebar)
│   │   └── types/               # TypeScript type definitions
│   ├── public/                  # Static assets (logo)
│   ├── Dockerfile               # Multi-stage: Node build → Nginx serve
│   └── nginx.conf               # SPA fallback + caching
│
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── main.py              # FastAPI app + router registration
│   │   ├── config.py            # Pydantic settings (env-based)
│   │   ├── database.py          # Async SQLAlchemy engine + session
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── user.py          # Role, User (UUID PKs)
│   │   │   ├── inquiry.py       # Inquiry with status/payment enums
│   │   │   ├── settlement.py    # Settlement tracking
│   │   │   ├── notification.py  # User notifications
│   │   │   └── activity.py      # Activity audit log
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routers/             # API route handlers (27 endpoints)
│   │   │   ├── auth.py          # Login, refresh, logout, me
│   │   │   ├── users.py         # CRUD (admin only)
│   │   │   ├── inquiries.py     # CRUD + status transitions + payment
│   │   │   ├── settlements.py   # CRUD + export + summary
│   │   │   ├── dashboard.py     # Stats per role + chart data
│   │   │   └── notifications.py # List + mark read
│   │   ├── services/            # Business logic (auth_service, etc.)
│   │   ├── middleware/          # Custom middleware
│   │   └── seed.py             # Database seeder (roles + test users)
│   ├── alembic/                 # Database migrations
│   │   └── versions/
│   │       ├── 733d2315b309_initial_tables.py
│   │       └── 083338246a66_add_notifications_table.py
│   ├── tests/                   # Test suite
│   ├── Dockerfile               # Python 3.12-slim + entrypoint
│   └── entrypoint.sh            # Runs migrations → seed → uvicorn
│
├── nginx/                       # Reverse proxy config
│   └── default.conf             # Routes / → frontend, /api/ → backend
│
├── docker-compose.yml           # Production: postgres + backend + frontend + nginx
├── docker-compose.dev.yml       # Development: postgres only
└── .env                         # Docker secrets (DB_PASSWORD, JWT_SECRET_KEY)
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended)
- OR: Node.js 20+, Python 3.12+, PostgreSQL 16+

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-username/shagun-catering-erp.git
cd shagun-catering-erp

# Start all services (PostgreSQL + Backend + Frontend + Nginx)
docker compose build
docker compose up -d
```

The application will be available at **http://localhost**. Migrations and seed data run automatically on first start.

```bash
# View logs
docker compose logs -f backend

# Stop all services
docker compose down

# Stop and wipe database
docker compose down -v
```

### Option 2: Local Development

```bash
# 1. Start PostgreSQL (Docker or local)
docker compose -f docker-compose.dev.yml up -d

# 2. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt

# Set up database
alembic upgrade head
python -m app.seed

# Start dev server
uvicorn app.main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger Docs: http://localhost:8000/api/docs

---

## Default Login Credentials

| Email | Password | Role |
|-------|----------|------|
| `admin@shaguncatering.com` | `admin123` | Admin |
| `vinod@shaguncatering.com` | `vinod123` | Sales Head |
| `vishal@shaguncatering.com` | `vishal123` | Menu Planner |
| `shayank@shaguncatering.com` | `shayank123` | Presentation Exec |
| `lalit@shaguncatering.com` | `lalit123` | Operations Manager |
| `kitchen@shaguncatering.com` | `kitchen123` | Kitchen |
| `thol@shaguncatering.com` | `thol123` | Warehouse |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (returns JWT access token) |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/me` | Get current user profile |

### Users (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users (paginated, filterable) |
| GET | `/api/users/{id}` | Get user by ID |
| POST | `/api/users` | Create user |
| PUT | `/api/users/{id}` | Update user |
| DELETE | `/api/users/{id}` | Deactivate user |

### Inquiries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inquiries` | List inquiries (paginated, filterable) |
| GET | `/api/inquiries/{id}` | Get inquiry details |
| POST | `/api/inquiries` | Create inquiry |
| PUT | `/api/inquiries/{id}` | Update inquiry |
| PATCH | `/api/inquiries/{id}/status` | Transition status (state machine) |
| PATCH | `/api/inquiries/{id}/payment` | Update payment status |

### Settlements (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settlements` | List settlements |
| GET | `/api/settlements/summary` | Aggregated summary |
| GET | `/api/settlements/{id}` | Get settlement details |
| GET | `/api/settlements/event/{inquiry_id}` | Get settlement by event |
| POST | `/api/settlements` | Create settlement |
| PUT | `/api/settlements/{id}` | Update settlement |
| PATCH | `/api/settlements/{id}/status` | Mark completed |
| GET | `/api/settlements/export/excel` | Export as Excel (.xlsx) |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/admin` | Admin KPIs |
| GET | `/api/dashboard/sales` | Sales KPIs |
| GET | `/api/dashboard/finance` | Finance KPIs |
| GET | `/api/dashboard/menu-planner` | Menu planner KPIs |
| GET | `/api/dashboard/presentation` | Presentation KPIs |
| GET | `/api/dashboard/operations` | Operations KPIs |
| GET | `/api/dashboard/kitchen` | Kitchen KPIs |
| GET | `/api/dashboard/warehouse` | Warehouse KPIs |
| GET | `/api/dashboard/charts/monthly-trend` | Monthly trend data |
| GET | `/api/dashboard/charts/conversion-rate` | Conversion rate data |
| GET | `/api/dashboard/charts/sales-funnel` | Sales funnel data |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications (paginated) |
| PATCH | `/api/notifications/{id}/read` | Mark as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health check |

**Swagger UI:** http://localhost/api/docs

---

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#5A0016` → `#3D000F` | Maroon brand color, buttons, accents |
| Canvas | `#F5F0E8` | Warm cream background |
| Status: New | Emerald `#10B981` | New inquiry |
| Status: Follow Up | Amber `#F59E0B` | Pending follow-up |
| Status: Confirmed | Blue `#3B82F6` | Confirmed event |
| Status: Cancelled | Rose `#F43F5E` | Cancelled inquiry |
| Fonts | Inter (sans), Playfair Display (brand headings) |
| Shadows | `shadow-md` on cards, graphs, tables; `hover:shadow-lg` on KPI cards |
| Animations | Framer Motion: staggered KPI entry, spring sidebar, hover lift, fade-in transitions |

---

## Environment Variables

### Root `.env` (Docker secrets)
```env
DB_PASSWORD=your-secure-password
JWT_SECRET_KEY=your-64-char-hex-secret
```

### Backend `backend/.env`
```env
DATABASE_URL=postgresql+asyncpg://shagun:password@localhost:5432/shagun_erp
JWT_SECRET_KEY=your-64-char-hex-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["http://localhost:5173","http://localhost","http://localhost:80"]
ENVIRONMENT=development
```

### Frontend `frontend/.env`
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_GEMINI_API_KEY=your-google-gemini-api-key
```

### Frontend `frontend/.env.production`
```env
VITE_API_BASE_URL=/api
```

---

## Database Schema

### Core Tables

- **roles** — Role definitions with JSONB permissions
- **users** — User accounts (UUID PK, email index, bcrypt password hash)
- **inquiries** — Event inquiries with status workflow + payment tracking
- **settlements** — Financial settlements linked to inquiries
- **notifications** — User-specific notification messages
- **activity_logs** — Audit trail for all actions

### Status Workflow (Inquiries)

```
NEW → FOLLOW_UP → MENU_READY → PRESENTATION_SENT → NEGOTIATION → CONFIRMED → COMPLETED
                    ↑                                        ↓
                    └──────── (parallel tracks) ──────────────┘
                                              ↓
                                         CANCELLED
```

---

## Scripts

```bash
# Frontend
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + production build
npm run lint         # Run Oxlint
npm run preview      # Preview production build locally

# Backend
uvicorn app.main:app --reload         # Dev server with auto-reload
alembic upgrade head                  # Run pending migrations
alembic revision --autogenerate -m "description"  # Create new migration
python -m app.seed                    # Seed roles + test users (idempotent)

# Docker
docker compose build                  # Rebuild all images
docker compose up -d                  # Start all services
docker compose down                   # Stop all services
docker compose logs -f backend        # Follow backend logs
docker compose exec backend alembic upgrade head  # Run migrations in container
```

---

## License

This project is proprietary to Shagun Catering & Events.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
