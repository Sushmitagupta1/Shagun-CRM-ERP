# Shagun ERP — Plan 3: Frontend Foundation (Vite + React + Design System + Layout)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the React 19 frontend with Vite, Tailwind CSS, Shadcn/UI, design system tokens, and the full layout shell (sidebar + top nav + canvas) — producing a running app with the maroon/gold theme visible.

**Architecture:** Vite 6 + React 19 + TypeScript. Tailwind CSS 4 with custom design tokens (maroon, gold, cream). Shadcn/UI (New York style) for base components. React Router v7 for routing. Zustand for auth state. Axios with interceptors for API calls.

**Depends on:** None (frontend-only, no backend needed yet — uses mock data).

---

## File Structure

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── api/
│   │   └── client.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopNav.tsx
│   │   │   └── DashboardLayout.tsx
│   │   ├── ui/                  # Shadcn components
│   │   └── common/
│   │       ├── KPICard.tsx
│   │       ├── StatusPill.tsx
│   │       └── PageHeader.tsx
│   ├── lib/
│   │   ├── utils.ts
│   │   └── constants.ts
│   ├── store/
│   │   └── authStore.ts
│   ├── types/
│   │   └── common.ts
│   └── routes/
│       └── ProtectedRoute.tsx
├── components.json
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── package.json
└── .env
```

---

### Task 1: Initialize Vite + React Project

**Files:**
- Create: `frontend/` (scaffolded by Vite)

- [ ] **Step 1: Create Vite project**

Run from `D:\Shagun CRM`:
```bash
npm create vite@latest frontend -- --template react-ts
```

- [ ] **Step 2: Install core dependencies**

```bash
cd D:\Shagun CRM\frontend
npm install
npm install react-router-dom@7 zustand axios dayjs sonner lucide-react react-icons framer-motion
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Install Shadcn/UI**

```bash
cd D:\Shagun CRM\frontend
npx shadcn@latest init
```

Select: New York style, Slate base color, CSS variables: yes.

Then install needed components:
```bash
npx shadcn@latest add button card input label select table badge dialog dropdown-menu separator avatar sheet tabs tooltip
```

- [ ] **Step 4: Install chart and form libraries**

```bash
cd D:\Shagun CRM\frontend
npm install recharts @tanstack/react-table @tanstack/react-query react-hook-form @hookform/resolvers zod
```

- [ ] **Step 5: Verify app starts**

```bash
cd D:\Shagun CRM\frontend
npm run dev
```

Open `http://localhost:5173` — should show default Vite React page.

- [ ] **Step 6: Commit**

```bash
cd D:\Shagun CRM\frontend
git init
git add .
git commit -m "feat: initialize Vite + React 19 project with dependencies"
```

---

### Task 2: Tailwind Design System Tokens

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/index.css`
- Modify: `frontend/index.html`

- [ ] **Step 1: Update tailwind.config.ts with design tokens**

Replace `frontend/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: "#5A0016",
          dark: "#3D000F",
          light: "#7A1030",
        },
        gold: {
          DEFAULT: "#D97706",
          light: "#CCA052",
          hover: "#B46104",
          50: "#FFFBEB",
        },
        cream: "#FAFAF7",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        brand: ["Playfair Display", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 2: Update index.css with Tailwind directives and CSS variables**

Replace `frontend/src/index.css`:
```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 24 90% 44%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 24 90% 44%;
    --radius: 0.75rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-cream text-gray-800 antialiased;
    font-family: "Inter", system-ui, sans-serif;
  }
}

@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap");
```

- [ ] **Step 3: Update index.html to load fonts**

Replace `frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shagun Catering ERP</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Verify theme renders**

```bash
cd D:\Shagun CRM\frontend
npm run dev
```

The body should now have the cream background (`#FAFAF7`).

- [ ] **Step 5: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add Tailwind design system tokens and custom theme"
```

---

### Task 3: Utility Functions & Types

**Files:**
- Create: `frontend/src/lib/utils.ts`
- Create: `frontend/src/lib/constants.ts`
- Create: `frontend/src/types/common.ts`
- Create: `frontend/src/types/auth.ts`
- Create: `frontend/src/types/inquiry.ts`
- Create: `frontend/src/types/settlement.ts`
- Create: `frontend/src/types/dashboard.ts`

- [ ] **Step 1: Create utils.ts**

Replace `frontend/src/lib/utils.ts`:
```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import dayjs from "dayjs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return dayjs(date).format("DD MMM YYYY");
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return "—";
  return dayjs(date).format("DD MMM YYYY, hh:mm A");
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}
```

- [ ] **Step 2: Create constants.ts**

Create `frontend/src/lib/constants.ts`:
```ts
export const INQUIRY_STATUSES = {
  new: { label: "New", color: "info" },
  follow_up: { label: "Follow Up", color: "warning" },
  menu_ready: { label: "Menu Ready", color: "info" },
  presentation_sent: { label: "Presentation Sent", color: "info" },
  negotiation: { label: "Negotiation", color: "warning" },
  confirmed: { label: "Confirmed", color: "success" },
  cancelled: { label: "Cancelled", color: "danger" },
} as const;

export const PAYMENT_STATUSES = {
  unpaid: { label: "Unpaid", color: "danger" },
  partial: { label: "Partial", color: "warning" },
  paid: { label: "Paid", color: "success" },
} as const;

export const SETTLEMENT_STATUSES = {
  pending: { label: "Pending", color: "warning" },
  completed: { label: "Completed", color: "success" },
} as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales_head: "Sales Head",
  menu_planner: "Menu Planner",
  presentation_exec: "Presentation Executive",
  operations_manager: "Operations Manager",
  kitchen: "Kitchen",
  warehouse: "Warehouse",
  finance: "Finance",
};

export const EVENT_TYPES = [
  "Wedding",
  "Birthday",
  "Corporate",
  "Anniversary",
  "Engagement",
  "Other",
];
```

- [ ] **Step 3: Create TypeScript types**

Create `frontend/src/types/common.ts`:
```ts
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
```

Create `frontend/src/types/auth.ts`:
```ts
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: {
    id: string;
    name: string;
  };
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
```

Create `frontend/src/types/inquiry.ts`:
```ts
export interface Inquiry {
  id: string;
  client_name: string;
  client_phone: string;
  event_type: string;
  event_date: string | null;
  pax: number | null;
  budget: number | null;
  status: string;
  assigned_to: string | null;
  created_by: string;
  follow_up_date: string | null;
  remarks: string | null;
  advance_amount: number;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

export interface InquiryCreate {
  client_name: string;
  client_phone: string;
  event_type: string;
  event_date?: string;
  pax?: number;
  budget?: number;
  assigned_to?: string;
  follow_up_date?: string;
  remarks?: string;
}
```

Create `frontend/src/types/settlement.ts`:
```ts
export interface Settlement {
  id: string;
  inquiry_id: string;
  revenue: number;
  vendor_cost: number;
  other_expenses: number;
  net_profit: number;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface SettlementCreate {
  inquiry_id: string;
  revenue: number;
  vendor_cost?: number;
  other_expenses?: number;
  notes?: string;
}
```

Create `frontend/src/types/dashboard.ts`:
```ts
export interface AdminKPIs {
  total_inquiries: number;
  confirmed: number;
  cancelled: number;
  upcoming_events: number;
  today_events: number;
  pending_payments: number;
  total_revenue: number;
  outstanding_amount: number;
  pending_kitchen_plans: number;
  pending_warehouse_requests: number;
}

export interface SalesKPIs {
  new_inquiries: number;
  followups_today: number;
  overdue_followups: number;
  confirmed: number;
  cancelled: number;
  pending_presentations: number;
  pending_menus: number;
  pending_payments: number;
  total_sales_value: number;
  conversion_rate: number;
}

export interface FinanceKPIs {
  pending_settlements: number;
  completed_settlements: number;
  total_profit: number;
  total_revenue: number;
  total_vendor_cost: number;
}

export interface MonthlyTrend {
  month: string;
  count: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
}
```

- [ ] **Step 4: Install clsx and tailwind-merge**

```bash
cd D:\Shagun CRM\frontend
npm install clsx tailwind-merge
```

- [ ] **Step 5: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add utility functions, constants, and TypeScript types"
```

---

### Task 4: Auth Store (Zustand) & Axios Client

**Files:**
- Create: `frontend/src/store/authStore.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Create auth store**

Create `frontend/src/store/authStore.ts`:
```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types/auth";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) =>
        set({ user, token, isAuthenticated: true }),
      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),
      setUser: (user) => set({ user }),
    }),
    {
      name: "shagun-auth",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

- [ ] **Step 2: Create Axios client with interceptors**

Create `frontend/src/api/client.ts`:
```ts
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const stored = localStorage.getItem("shagun-auth");
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    } catch {}
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { access_token } = refreshResponse.data;

        const stored = localStorage.getItem("shagun-auth");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.state.token = access_token;
          localStorage.setItem("shagun-auth", JSON.stringify(parsed));
        }

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch {
        localStorage.removeItem("shagun-auth");
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

- [ ] **Step 3: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add Zustand auth store and Axios client with interceptors"
```

---

### Task 5: Layout Components (Sidebar + TopNav + Shell)

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/TopNav.tsx`
- Create: `frontend/src/components/layout/DashboardLayout.tsx`

- [ ] **Step 1: Create Sidebar component**

Create `frontend/src/components/layout/Sidebar.tsx`:
```tsx
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  DollarSign,
  Bell,
  Calendar,
  Settings,
  BarChart3,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["admin", "sales_head"] },
  { label: "Inquiries", icon: FileText, path: "/inquiries", roles: ["admin", "sales_head"] },
  { label: "Users", icon: Users, path: "/users", roles: ["admin"] },
  { label: "Finance", icon: DollarSign, path: "/finance", roles: ["admin"] },
  { label: "Calendar", icon: Calendar, path: "/calendar", roles: ["admin", "sales_head"] },
  { label: "Reports", icon: BarChart3, path: "/reports", roles: ["admin"] },
  { label: "Notifications", icon: Bell, path: "/notifications", roles: ["admin", "sales_head"] },
  { label: "Settings", icon: Settings, path: "/settings", roles: ["admin"] },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const userRole = user?.role?.name || "";

  const filteredMenu = menuItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-gradient-to-b from-maroon to-maroon-dark text-white z-50 flex flex-col">
      {/* Logo */}
      <div className="h-[70px] flex items-center justify-center border-b border-white/10">
        <div className="text-center">
          <h1 className="font-brand text-xl font-bold text-gold tracking-wide">
            SHAGUN
          </h1>
          <p className="text-[10px] text-white/70 tracking-[0.2em] uppercase">
            Catering & Events
          </p>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {filteredMenu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition-all",
                isActive
                  ? "bg-gold text-white shadow-sm"
                  : "text-white/80 hover:bg-white/8 hover:text-white"
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium text-white/80 hover:bg-white/8 hover:text-white transition-all w-full"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create TopNav component**

Create `frontend/src/components/layout/TopNav.tsx`:
```tsx
import { Search, Bell, Menu } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { ROLE_LABELS } from "@/lib/constants";

interface TopNavProps {
  onMenuToggle?: () => void;
}

export function TopNav({ onMenuToggle }: TopNavProps) {
  const { user } = useAuthStore();

  return (
    <header className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Left: Hamburger + Page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-md hover:bg-gray-100"
        >
          <Menu className="h-5 w-5 text-gray-500" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">Dashboard</h2>
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full h-9 pl-10 pr-4 rounded-full bg-gray-100 border-none text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
      </div>

      {/* Right: Notifications + Profile */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
          <Bell className="h-5 w-5 text-gray-600" />
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            3
          </span>
        </button>

        {/* Profile Chip */}
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-gold/10 border-[1.5px] border-gold flex items-center justify-center text-gold font-semibold text-sm">
            {user?.full_name?.charAt(0) || "A"}
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px] font-bold text-gray-900 leading-tight">
              {user?.full_name || "Admin"}
            </p>
            <p className="text-[11px] text-gray-500">
              {ROLE_LABELS[user?.role?.name || ""] || user?.role?.name || ""}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create DashboardLayout shell**

Create `frontend/src/components/layout/DashboardLayout.tsx`:
```tsx
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-cream">
      {/* Sidebar — desktop always visible, mobile toggle */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:ml-[240px]">
        <TopNav onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add layout components (Sidebar, TopNav, DashboardLayout)"
```

---

### Task 6: Common Components (KPICard, StatusPill, PageHeader)

**Files:**
- Create: `frontend/src/components/common/KPICard.tsx`
- Create: `frontend/src/components/common/StatusPill.tsx`
- Create: `frontend/src/components/common/PageHeader.tsx`

- [ ] **Step 1: Create KPICard**

Create `frontend/src/components/common/KPICard.tsx`:
```tsx
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function KPICard({ label, value, trend, className }: KPICardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-100 shadow-sm p-4 h-[105px] flex flex-col justify-between",
        className
      )}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-[26px] font-bold text-gray-900 leading-tight">
        {value}
      </p>
      {trend && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-semibold",
            trend.isPositive ? "text-emerald-600" : "text-red-600"
          )}
        >
          {trend.isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>
            {trend.isPositive ? "+" : ""}
            {trend.value}%
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create StatusPill**

Create `frontend/src/components/common/StatusPill.tsx`:
```tsx
import { cn } from "@/lib/utils";

type PillColor = "success" | "warning" | "danger" | "info";

const colorClasses: Record<PillColor, string> = {
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-rose-100 text-rose-800",
  info: "bg-blue-100 text-blue-800",
};

interface StatusPillProps {
  label: string;
  color: PillColor | string;
}

export function StatusPill({ label, color }: StatusPillProps) {
  const colorClass = colorClasses[color as PillColor] || colorClasses.info;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
        colorClass
      )}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Create PageHeader**

Create `frontend/src/components/common/PageHeader.tsx`:
```tsx
interface PageHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      {action}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add common components (KPICard, StatusPill, PageHeader)"
```

---

### Task 7: Protected Route & Router Setup

**Files:**
- Create: `frontend/src/routes/ProtectedRoute.tsx`
- Create: `frontend/src/routes/index.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create ProtectedRoute**

Create `frontend/src/routes/ProtectedRoute.tsx`:
```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user?.role?.name && !allowedRoles.includes(user.role.name)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 2: Create route definitions**

Create `frontend/src/routes/index.tsx`:
```tsx
import { createBrowserRouter } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import UserManagement from "@/pages/admin/UserManagement";
import FinancePage from "@/pages/admin/FinancePage";
import SalesDashboard from "@/pages/sales/SalesDashboard";
import InquiryList from "@/pages/inquiries/InquiryList";
import NotFound from "@/pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: "/dashboard", element: <AdminDashboard /> },
          { path: "/users", element: <UserManagement /> },
          { path: "/finance", element: <FinancePage /> },
          { path: "/sales", element: <SalesDashboard /> },
          { path: "/inquiries", element: <InquiryList /> },
          { path: "/", element: <AdminDashboard /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
```

- [ ] **Step 3: Create placeholder pages**

Create `frontend/src/pages/Login.tsx`:
```tsx
export default function Login() {
  return <div className="min-h-screen bg-cream flex items-center justify-center">
    <div className="text-center">
      <h1 className="font-brand text-4xl font-bold text-maroon">SHAGUN</h1>
      <p className="text-gray-500 mt-2">Login page — Coming in Task 8</p>
    </div>
  </div>;
}
```

Create `frontend/src/pages/NotFound.tsx`:
```tsx
export default function NotFound() {
  return <div className="text-center py-20"><h1 className="text-4xl font-bold text-gray-900">404</h1><p className="text-gray-500 mt-2">Page not found</p></div>;
}
```

Create `frontend/src/pages/admin/AdminDashboard.tsx`:
```tsx
import { PageHeader } from "@/components/common/PageHeader";
export default function AdminDashboard() {
  return <div><PageHeader title="Admin Dashboard" /><p className="text-gray-500">Dashboard content — Coming in Plan 4</p></div>;
}
```

Create `frontend/src/pages/admin/UserManagement.tsx`:
```tsx
import { PageHeader } from "@/components/common/PageHeader";
export default function UserManagement() {
  return <div><PageHeader title="User Management" /><p className="text-gray-500">User management — Coming in Plan 4</p></div>;
}
```

Create `frontend/src/pages/admin/FinancePage.tsx`:
```tsx
import { PageHeader } from "@/components/common/PageHeader";
export default function FinancePage() {
  return <div><PageHeader title="Finance & Settlements" /><p className="text-gray-500">Finance page — Coming in Plan 6</p></div>;
}
```

Create `frontend/src/pages/sales/SalesDashboard.tsx`:
```tsx
import { PageHeader } from "@/components/common/PageHeader";
export default function SalesDashboard() {
  return <div><PageHeader title="Sales Dashboard" /><p className="text-gray-500">Sales dashboard — Coming in Plan 5</p></div>;
}
```

Create `frontend/src/pages/inquiries/InquiryList.tsx`:
```tsx
import { PageHeader } from "@/components/common/PageHeader";
export default function InquiryList() {
  return <div><PageHeader title="Inquiries" /><p className="text-gray-500">Inquiry list — Coming in Plan 5</p></div>;
}
```

- [ ] **Step 4: Update App.tsx and main.tsx**

Replace `frontend/src/App.tsx`:
```tsx
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";

function App() {
  return <RouterProvider router={router} />;
}

export default App;
```

Replace `frontend/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Update vite.config.ts with path alias**

Replace `frontend/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 6: Verify layout renders**

```bash
cd D:\Shagun CRM\frontend
npm run dev
```

Visit `http://localhost:5173` — should redirect to `/login` (placeholder). Manually navigate to `/dashboard` — should show the layout shell with maroon sidebar and white top nav.

- [ ] **Step 7: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add routing, protected routes, and placeholder pages"
```

---

### Task 8: API Auth Functions

**Files:**
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/hooks/useAuth.ts`

- [ ] **Step 1: Create auth API functions**

Create `frontend/src/api/auth.ts`:
```ts
import apiClient from "./client";
import type { LoginRequest, TokenResponse, User } from "@/types/auth";

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const response = await apiClient.post("/auth/login", data);
  return response.data;
}

export async function getMe(): Promise<User> {
  const response = await apiClient.get("/auth/me");
  return response.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}
```

- [ ] **Step 2: Create useAuth hook**

Create `frontend/src/hooks/useAuth.ts`:
```ts
import { useAuthStore } from "@/store/authStore";
import * as authApi from "@/api/auth";
import { useCallback } from "react";

export function useAuth() {
  const { login: storeLogin, logout: storeLogout, user } = useAuthStore();

  const login = useCallback(
    async (email: string, password: string) => {
      const tokenResponse = await authApi.login({ email, password });
      const userResponse = await authApi.getMe();
      storeLogin(userResponse, tokenResponse.access_token);
      return userResponse;
    },
    [storeLogin]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      storeLogout();
    }
  }, [storeLogout]);

  return { login, logout, user };
}
```

- [ ] **Step 3: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add auth API functions and useAuth hook"
```

---

## Summary

After completing all 8 tasks, the frontend will have:
- Vite + React 19 + TypeScript running
- Tailwind CSS with custom design tokens (maroon, gold, cream)
- Shadcn/UI installed with base components
- Layout shell: 240px maroon sidebar with gold active state + 60px white top nav
- KPICard, StatusPill, PageHeader common components
- Zustand auth store with persist middleware
- Axios client with auth interceptors and auto-refresh
- React Router with protected routes
- Placeholder pages for all Phase 1 views
- All TypeScript types defined
