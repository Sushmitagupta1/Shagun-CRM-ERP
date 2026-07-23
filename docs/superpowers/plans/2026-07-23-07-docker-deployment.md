# Shagun ERP — Plan 7: Docker Compose + Nginx + Production Config

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the entire ERP (frontend, backend, PostgreSQL, Nginx) into Docker containers with a single `docker-compose up` command, and configure Nginx as a reverse proxy.

**Architecture:** Docker Compose with 4 services: PostgreSQL (data), Backend (FastAPI), Frontend (built React served by Nginx), Nginx (reverse proxy). Nginx serves frontend static files and proxies `/api` to backend.

**Depends on:** Plans 1-6 (all code must be in place).

---

### Task 1: Frontend Dockerfile & Production Build

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`

- [ ] **Step 1: Create frontend Dockerfile**

Create `frontend/Dockerfile`:
```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 2: Create frontend nginx.conf**

Create `frontend/nginx.conf`:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # No cache for HTML
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

- [ ] **Step 3: Create frontend .env for production**

Create `frontend/.env.production`:
```
VITE_API_BASE_URL=/api
```

This ensures the frontend calls `/api` (relative) in production, which Nginx proxies to the backend.

- [ ] **Step 4: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add frontend Dockerfile and nginx config"
```

---

### Task 2: Backend Dockerfile

**Files:**
- Modify: `backend/Dockerfile`

- [ ] **Step 1: Update backend Dockerfile for production**

Replace `backend/Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Commit**

```bash
cd D:\Shagun CRM\backend
git add .
git commit -m "feat: update backend Dockerfile for production"
```

---

### Task 3: Nginx Reverse Proxy

**Files:**
- Create: `nginx/default.conf`

- [ ] **Step 1: Create Nginx config**

```bash
mkdir -p D:\Shagun CRM\nginx
```

Create `nginx/default.conf`:
```nginx
upstream backend {
    server backend:8000;
}

server {
    listen 80;
    server_name localhost;

    # Frontend static files
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Swagger docs
    location /api/docs {
        proxy_pass http://backend/api/docs;
        proxy_set_header Host $host;
    }

    location /api/redoc {
        proxy_pass http://backend/api/redoc;
        proxy_set_header Host $host;
    }

    # API openapi.json
    location /openapi.json {
        proxy_pass http://backend/openapi.json;
        proxy_set_header Host $host;
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\Shagun CRM
git add nginx/
git commit -m "feat: add Nginx reverse proxy config"
```

---

### Task 4: Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml` (optional override for dev)
- Create: `.env` (root)
- Create: `.env.example` (root)

- [ ] **Step 1: Create root .env**

Create `.env` at project root:
```
DB_PASSWORD=shagun123
JWT_SECRET_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

- [ ] **Step 2: Create .env.example**

Create `.env.example` at project root:
```
DB_PASSWORD=replace-with-strong-password
JWT_SECRET_KEY=replace-with-random-64-char-hex
```

- [ ] **Step 3: Create docker-compose.yml**

Create `docker-compose.yml`:
```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: shagun_erp
      POSTGRES_USER: shagun
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shagun -d shagun_erp"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://shagun:${DB_PASSWORD}@postgres:5432/shagun_erp
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      CORS_ORIGINS: '["http://localhost","http://localhost:80"]'
      ENVIRONMENT: production
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build: ./frontend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  pgdata:
```

- [ ] **Step 4: Create docker-compose.dev.yml for local development**

Create `docker-compose.dev.yml`:
```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: shagun_erp
      POSTGRES_USER: shagun
      POSTGRES_PASSWORD: shagun123
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 5: Test Docker Compose**

Build and start all services:
```bash
cd D:\Shagun CRM
docker-compose build
docker-compose up -d
```

Verify all containers are running:
```bash
docker-compose ps
```

Expected: 4 containers (postgres, backend, frontend, nginx) all "Up".

- [ ] **Step 6: Run seed script inside backend container**

```bash
docker-compose exec backend python -m app.seed
```

- [ ] **Step 7: Test the full stack**

Open `http://localhost` in browser:
- Should load the React login page
- Login with admin@shaguncatering.com / admin123
- Should redirect to Admin Dashboard
- All API calls should work through Nginx proxy

Also test API docs at `http://localhost/api/docs`

- [ ] **Step 8: Commit**

```bash
cd D:\Shagun CRM
git add .
git commit -m "feat: add Docker Compose with all services and Nginx proxy"
```

---

### Task 5: Gitignore & README

**Files:**
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Create .gitignore**

Create `.gitignore` at project root:
```
# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# Build
dist/
build/
*.egg-info/

# Environment
.env
!.env.example

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docker
pgdata/

# Logs
*.log

# Coverage
htmlcov/
.coverage
```

- [ ] **Step 2: Create README.md**

Create `README.md`:
```markdown
# Shagun Catering ERP

Enterprise Resource Planning system for Shagun Catering & Events.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Shadcn/UI
- **Backend:** FastAPI, SQLAlchemy 2.0, PostgreSQL
- **Auth:** JWT (access + refresh tokens)
- **Charts:** Recharts
- **Deploy:** Docker, Nginx

## Quick Start

### Development (Docker only for DB)

```bash
# Start PostgreSQL
docker-compose -f docker-compose.dev.yml up -d

# Backend
cd backend
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### Production (Full Docker)

```bash
docker-compose build
docker-compose up -d
docker-compose exec backend python -m app.seed
```

Open http://localhost

### Default Login

- Email: admin@shaguncatering.com
- Password: admin123

## Project Structure

```
shagun-erp/
├── frontend/          # React 19 + Vite
├── backend/           # FastAPI + SQLAlchemy
├── nginx/             # Reverse proxy config
├── docker-compose.yml
└── README.md
```

## API Documentation

Visit http://localhost/api/docs for Swagger UI.
```

- [ ] **Step 3: Initialize root git repo**

```bash
cd D:\Shagun CRM
git init
git add .
git commit -m "feat: initial project structure with Docker Compose"
```

- [ ] **Step 4: Commit**

```bash
cd D:\Shagun CRM
git add .
git commit -m "docs: add README and .gitignore"
```

---

## Summary

After completing all 5 tasks:
- **Docker Compose** runs all 4 services with one command
- **Nginx** reverse proxies `/api` to backend and `/` to frontend
- **Frontend** built and served as static files
- **Backend** connected to PostgreSQL with async driver
- **Seed data** runs inside container
- **Full stack** accessible at `http://localhost`
- **README** with quick start instructions

---

# All 7 Plans Complete

| Plan | What it builds | Tasks |
|------|---------------|-------|
| 1 | Backend Foundation (FastAPI, models, auth, seed) | 9 |
| 2 | Backend APIs (Inquiries, Settlements, Dashboard, Notifications) | 8 |
| 3 | Frontend Foundation (Vite, Tailwind, Layout, Types) | 8 |
| 4 | Frontend Login + Admin Dashboard + User Management | 4 |
| 5 | Frontend Sales Dashboard + Inquiry Pages | 3 |
| 6 | Frontend Finance & Settlements | 2 |
| 7 | Docker Compose + Nginx + Production Config | 5 |
