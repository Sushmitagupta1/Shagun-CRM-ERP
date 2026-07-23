# Shagun ERP — Plan 4: Frontend Login + Admin Dashboard + User Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Login page, Admin Dashboard (KPIs + charts), and User Management page — connecting the frontend to the backend API.

**Architecture:** React Hook Form + Zod for login form validation. TanStack Query for server state (KPIs, charts, user list). Recharts for bar/donut charts. TanStack Table for user management grid.

**Depends on:** Plan 2 (Backend APIs) + Plan 3 (Frontend Foundation).

---

### Task 1: Login Page

**Files:**
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Build the Login page**

Replace `frontend/src/pages/Login.tsx`:
```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success("Login successful!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-brand text-4xl font-bold text-maroon">SHAGUN</h1>
          <p className="text-sm text-gray-500 tracking-[0.2em] uppercase mt-1">
            Catering & Events
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Sign In</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Email
              </label>
              <input
                {...register("email")}
                type="email"
                placeholder="admin@shaguncatering.com"
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Password
              </label>
              <input
                {...register("password")}
                type="password"
                placeholder="Enter password"
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
              />
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-gold hover:bg-gold-hover text-white font-medium rounded-lg shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update routes to redirect / to /login when not authenticated**

The ProtectedRoute already handles this. Verify by running:
```bash
cd D:\Shagun CRM\frontend
npm run dev
```

Visit `http://localhost:5173` — should show Login page.

- [ ] **Step 3: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add Login page with React Hook Form + Zod validation"
```

---

### Task 2: Dashboard API Functions & Hooks

**Files:**
- Create: `frontend/src/api/dashboard.ts`
- Create: `frontend/src/api/inquiries.ts`
- Create: `frontend/src/api/users.ts`
- Create: `frontend/src/hooks/useDashboard.ts`
- Create: `frontend/src/hooks/useInquiries.ts`
- Create: `frontend/src/hooks/useDebounce.ts`

- [ ] **Step 1: Create dashboard API**

Create `frontend/src/api/dashboard.ts`:
```ts
import apiClient from "./client";
import type { AdminKPIs, SalesKPIs, FinanceKPIs, MonthlyTrend, StatusDistribution, FunnelStage } from "@/types/dashboard";

export async function getAdminKPIs(): Promise<AdminKPIs> {
  const response = await apiClient.get("/dashboard/admin");
  return response.data;
}

export async function getSalesKPIs(): Promise<SalesKPIs> {
  const response = await apiClient.get("/dashboard/sales");
  return response.data;
}

export async function getFinanceKPIs(): Promise<FinanceKPIs> {
  const response = await apiClient.get("/dashboard/finance");
  return response.data;
}

export async function getMonthlyTrend(): Promise<MonthlyTrend[]> {
  const response = await apiClient.get("/dashboard/charts/monthly-trend");
  return response.data;
}

export async function getConversionRate(): Promise<StatusDistribution[]> {
  const response = await apiClient.get("/dashboard/charts/conversion-rate");
  return response.data;
}

export async function getSalesFunnel(): Promise<FunnelStage[]> {
  const response = await apiClient.get("/dashboard/charts/sales-funnel");
  return response.data;
}
```

- [ ] **Step 2: Create inquiries API**

Create `frontend/src/api/inquiries.ts`:
```ts
import apiClient from "./client";
import type { PaginatedResponse } from "@/types/common";
import type { Inquiry, InquiryCreate } from "@/types/inquiry";

export async function getInquiries(params: {
  page?: number;
  per_page?: number;
  status?: string;
  search?: string;
}): Promise<PaginatedResponse<Inquiry>> {
  const response = await apiClient.get("/inquiries", { params });
  return response.data;
}

export async function getInquiry(id: string): Promise<Inquiry> {
  const response = await apiClient.get(`/inquiries/${id}`);
  return response.data;
}

export async function createInquiry(data: InquiryCreate): Promise<Inquiry> {
  const response = await apiClient.post("/inquiries", data);
  return response.data;
}

export async function updateInquiry(id: string, data: Partial<InquiryCreate>): Promise<Inquiry> {
  const response = await apiClient.put(`/inquiries/${id}`, data);
  return response.data;
}

export async function updateInquiryStatus(id: string, status: string): Promise<void> {
  await apiClient.patch(`/inquiries/${id}/status?new_status=${status}`);
}

export async function updatePayment(id: string, paymentStatus: string, advanceAmount?: number): Promise<void> {
  const params = new URLSearchParams({ payment_status: paymentStatus });
  if (advanceAmount !== undefined) params.append("advance_amount", String(advanceAmount));
  await apiClient.patch(`/inquiries/${id}/payment?${params.toString()}`);
}
```

- [ ] **Step 3: Create users API**

Create `frontend/src/api/users.ts`:
```ts
import apiClient from "./client";
import type { PaginatedResponse } from "@/types/common";
import type { User } from "@/types/auth";

export async function getUsers(params: {
  page?: number;
  per_page?: number;
  role?: string;
  search?: string;
}): Promise<PaginatedResponse<User>> {
  const response = await apiClient.get("/users", { params });
  return response.data;
}

export async function createUser(data: {
  email: string;
  password: string;
  full_name: string;
  role_id: string;
}): Promise<User> {
  const response = await apiClient.post("/users", data);
  return response.data;
}

export async function updateUser(id: string, data: Partial<{
  email: string;
  full_name: string;
  role_id: string;
  is_active: boolean;
}>): Promise<User> {
  const response = await apiClient.put(`/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
```

- [ ] **Step 4: Create useDashboard hook**

Create `frontend/src/hooks/useDashboard.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import * as dashboardApi from "@/api/dashboard";

export function useAdminKPIs() {
  return useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: dashboardApi.getAdminKPIs,
  });
}

export function useSalesKPIs() {
  return useQuery({
    queryKey: ["dashboard", "sales"],
    queryFn: dashboardApi.getSalesKPIs,
  });
}

export function useFinanceKPIs() {
  return useQuery({
    queryKey: ["dashboard", "finance"],
    queryFn: dashboardApi.getFinanceKPIs,
  });
}

export function useMonthlyTrend() {
  return useQuery({
    queryKey: ["dashboard", "monthly-trend"],
    queryFn: dashboardApi.getMonthlyTrend,
  });
}

export function useConversionRate() {
  return useQuery({
    queryKey: ["dashboard", "conversion-rate"],
    queryFn: dashboardApi.getConversionRate,
  });
}

export function useSalesFunnel() {
  return useQuery({
    queryKey: ["dashboard", "sales-funnel"],
    queryFn: dashboardApi.getSalesFunnel,
  });
}
```

- [ ] **Step 5: Create useInquiries hook**

Create `frontend/src/hooks/useInquiries.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import * as inquiriesApi from "@/api/inquiries";

export function useInquiries(params: {
  page?: number;
  per_page?: number;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["inquiries", params],
    queryFn: () => inquiriesApi.getInquiries(params),
  });
}
```

- [ ] **Step 6: Create useDebounce hook**

Create `frontend/src/hooks/useDebounce.ts`:
```ts
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

- [ ] **Step 7: Add React Query Provider to main.tsx**

Update `frontend/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 8: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add API functions, hooks, and React Query provider"
```

---

### Task 3: Admin Dashboard Page

**Files:**
- Modify: `frontend/src/pages/admin/AdminDashboard.tsx`
- Create: `frontend/src/components/charts/InquiryTrend.tsx`
- Create: `frontend/src/components/charts/ConversionRate.tsx`
- Create: `frontend/src/components/charts/RevenueChart.tsx`

- [ ] **Step 1: Create InquiryTrend chart**

Create `frontend/src/components/charts/InquiryTrend.tsx`:
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { MonthlyTrend } from "@/types/dashboard";

interface InquiryTrendProps {
  data: MonthlyTrend[];
}

export function InquiryTrend({ data }: InquiryTrendProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B7280" }} />
        <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} />
        <Tooltip />
        <Bar dataKey="count" fill="#D97706" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create ConversionRate chart**

Create `frontend/src/components/charts/ConversionRate.tsx`:
```tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import type { StatusDistribution } from "@/types/dashboard";

const COLORS: Record<string, string> = {
  new: "#3B82F6",
  follow_up: "#F59E0B",
  menu_ready: "#8B5CF6",
  presentation_sent: "#06B6D4",
  negotiation: "#F97316",
  confirmed: "#10B981",
  cancelled: "#EF4444",
};

interface ConversionRateProps {
  data: StatusDistribution[];
}

export function ConversionRate({ data }: ConversionRateProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex items-center">
      <ResponsiveContainer width="60%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="count"
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={COLORS[entry.status] || "#9CA3AF"} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center pl-4">
        <p className="text-2xl font-bold text-gray-900">{total}</p>
        <p className="text-xs text-gray-500">Total Inquiries</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create RevenueChart**

Create `frontend/src/components/charts/RevenueChart.tsx`:
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { MonthlyTrend } from "@/types/dashboard";

interface RevenueChartProps {
  data: MonthlyTrend[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    revenue: d.count * 50000, // Placeholder — replace with real revenue data
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B7280" }} />
        <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} />
        <Tooltip formatter={(value: number) => `₹${value.toLocaleString("en-IN")}`} />
        <Legend />
        <Bar dataKey="revenue" fill="#D97706" name="Revenue" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Build AdminDashboard page**

Replace `frontend/src/pages/admin/AdminDashboard.tsx`:
```tsx
import { useAdminKPIs, useMonthlyTrend, useConversionRate } from "@/hooks/useDashboard";
import { useInquiries } from "@/hooks/useInquiries";
import { KPICard } from "@/components/common/KPICard";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { InquiryTrend } from "@/components/charts/InquiryTrend";
import { ConversionRate } from "@/components/charts/ConversionRate";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { formatCurrency } from "@/lib/utils";
import { INQUIRY_STATUSES } from "@/lib/constants";
import { Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const { data: kpis, isLoading: kpisLoading } = useAdminKPIs();
  const { data: trend } = useMonthlyTrend();
  const { data: conversion } = useConversionRate();
  const { data: inquiriesData, isLoading: inquiriesLoading } = useInquiries({ page: 1, per_page: 5 });

  if (kpisLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Admin Dashboard" />

      {/* KPI Cards — Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <KPICard label="Total Inquiries" value={kpis?.total_inquiries || 0} />
        <KPICard label="Confirmed" value={kpis?.confirmed || 0} />
        <KPICard label="Cancelled" value={kpis?.cancelled || 0} />
        <KPICard label="Upcoming Events" value={kpis?.upcoming_events || 0} />
        <KPICard label="Today's Events" value={kpis?.today_events || 0} />
      </div>

      {/* KPI Cards — Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KPICard label="Pending Payments" value={kpis?.pending_payments || 0} />
        <KPICard label="Total Revenue" value={formatCurrency(kpis?.total_revenue || 0)} />
        <KPICard label="Outstanding" value={formatCurrency(kpis?.outstanding_amount || 0)} />
        <KPICard label="Kitchen Pending" value={kpis?.pending_kitchen_plans || 0} />
        <KPICard label="Warehouse Pending" value={kpis?.pending_warehouse_requests || 0} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Monthly Inquiry Trend</h3>
          </div>
          <div className="p-5">
            <InquiryTrend data={trend || []} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Inquiry Distribution</h3>
          </div>
          <div className="p-5">
            <ConversionRate data={conversion || []} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Revenue Trend</h3>
          </div>
          <div className="p-5">
            <RevenueChart data={trend || []} />
          </div>
        </div>
      </div>

      {/* Recent Inquiries Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Recent Inquiries</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {inquiriesLoading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : inquiriesData?.items?.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No inquiries yet</td></tr>
              ) : (
                inquiriesData?.items?.map((inquiry) => (
                  <tr key={inquiry.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{inquiry.client_name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{inquiry.event_type}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{inquiry.event_date || "—"}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        label={INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.label || inquiry.status}
                        color={INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.color || "info"}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify Admin Dashboard renders**

```bash
cd D:\Shagun CRM\frontend
npm run dev
```

Login with admin credentials (requires backend running). Dashboard should show KPI cards and charts.

- [ ] **Step 6: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add Admin Dashboard with KPIs, charts, and inquiry table"
```

---

### Task 4: User Management Page

**Files:**
- Modify: `frontend/src/pages/admin/UserManagement.tsx`

- [ ] **Step 1: Build User Management page**

Replace `frontend/src/pages/admin/UserManagement.tsx`:
```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, createUser, deleteUser } from "@/api/users";
import { PageHeader } from "@/components/common/PageHeader";
import { ROLE_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Search } from "lucide-react";

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role_id: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["users", search],
    queryFn: () => getUsers({ search, per_page: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
      setShowCreate(false);
      setForm({ email: "", password: "", full_name: "", role_id: "" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deactivated");
    },
  });

  return (
    <div>
      <PageHeader
        title="User Management"
        action={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="h-9 px-4 bg-gold hover:bg-gold-hover text-white text-sm font-medium rounded-lg shadow transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add User
          </button>
        }
      />

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full h-9 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New User</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="h-10 px-3 rounded-lg border border-gray-200 text-sm"
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-10 px-3 rounded-lg border border-gray-200 text-sm"
            />
            <input
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="h-10 px-3 rounded-lg border border-gray-200 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm"
              >
                <option value="">Select Role</option>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending}
                className="h-10 px-4 bg-gold hover:bg-gold-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-gold mx-auto" /></td></tr>
            ) : data?.items?.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{user.full_name}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{user.email}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{ROLE_LABELS[user.role?.name] || user.role?.name}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${user.is_active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => deleteMutation.mutate(user.id)}
                    className="p-1.5 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify User Management works**

Navigate to `/users` while logged in as admin. Table should show users, form should create new ones.

- [ ] **Step 3: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add User Management page with create, search, delete"
```

---

## Summary

After completing all 4 tasks:
- **Login page** with form validation (Zod), error toasts, JWT storage
- **Admin Dashboard** with 10 KPI cards, 3 charts (bar, donut, bar), recent inquiries table
- **User Management** with search, create form, user table, deactivate
- All pages connected to backend via TanStack Query
