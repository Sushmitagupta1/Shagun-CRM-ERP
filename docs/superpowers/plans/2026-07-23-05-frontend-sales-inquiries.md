# Shagun ERP — Plan 5: Frontend Sales Dashboard + Inquiry Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Sales Head (Vinod) dashboard with sales funnel and follow-up widgets, plus the full Inquiry List and Inquiry Detail pages.

**Architecture:** Recharts for sales funnel visualization. TanStack Table for inquiry list with sorting, filtering, pagination. React Hook Form for inquiry create/edit. Status transition buttons with validation.

**Depends on:** Plan 3 (Frontend Foundation) + Plan 4 (API hooks already created).

---

### Task 1: Sales Funnel Chart

**Files:**
- Create: `frontend/src/components/charts/SalesFunnel.tsx`

- [ ] **Step 1: Create SalesFunnel component**

Create `frontend/src/components/charts/SalesFunnel.tsx`:
```tsx
import type { FunnelStage } from "@/types/dashboard";

const STAGE_COLORS = [
  "#5A0016", // Lead — maroon
  "#7A1030",
  "#D97706", // Mid — gold
  "#CCA052",
  "#10B981", // Confirmed — emerald
];

interface SalesFunnelProps {
  data: FunnelStage[];
}

export function SalesFunnel({ data }: SalesFunnelProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      {data.map((stage, index) => {
        const widthPercent = (stage.count / maxCount) * 100;
        return (
          <div key={stage.stage} className="flex items-center gap-3">
            <div className="w-28 text-right">
              <p className="text-xs font-medium text-gray-600">{stage.stage}</p>
            </div>
            <div className="flex-1 relative">
              <div
                className="h-8 rounded-md flex items-center justify-end pr-3 transition-all"
                style={{
                  width: `${Math.max(widthPercent, 8)}%`,
                  backgroundColor: STAGE_COLORS[index % STAGE_COLORS.length],
                }}
              >
                <span className="text-xs font-bold text-white">{stage.count}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add SalesFunnel chart component"
```

---

### Task 2: Sales Dashboard Page

**Files:**
- Modify: `frontend/src/pages/sales/SalesDashboard.tsx`

- [ ] **Step 1: Build Sales Dashboard**

Replace `frontend/src/pages/sales/SalesDashboard.tsx`:
```tsx
import { useSalesKPIs, useSalesFunnel } from "@/hooks/useDashboard";
import { useInquiries } from "@/hooks/useInquiries";
import { KPICard } from "@/components/common/KPICard";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { SalesFunnel } from "@/components/charts/SalesFunnel";
import { formatCurrency } from "@/lib/utils";
import { INQUIRY_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";
import { Loader2 } from "lucide-react";

export default function SalesDashboard() {
  const { data: kpis, isLoading } = useSalesKPIs();
  const { data: funnel } = useSalesFunnel();
  const { data: inquiriesData } = useInquiries({ page: 1, per_page: 10 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Sales Dashboard" />

      {/* KPI Cards — Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <KPICard label="New Inquiries" value={kpis?.new_inquiries || 0} />
        <KPICard label="Follow-ups Today" value={kpis?.followups_today || 0} />
        <KPICard
          label="Overdue Follow-ups"
          value={kpis?.overdue_followups || 0}
          trend={kpis?.overdue_followups ? { value: kpis.overdue_followups, isPositive: false } : undefined}
        />
        <KPICard label="Confirmed" value={kpis?.confirmed || 0} />
        <KPICard label="Cancelled" value={kpis?.cancelled || 0} />
      </div>

      {/* KPI Cards — Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KPICard label="Pending Presentations" value={kpis?.pending_presentations || 0} />
        <KPICard label="Pending Menus" value={kpis?.pending_menus || 0} />
        <KPICard label="Pending Payments" value={kpis?.pending_payments || 0} />
        <KPICard label="Total Sales" value={formatCurrency(kpis?.total_sales_value || 0)} />
        <KPICard
          label="Conversion Rate"
          value={`${kpis?.conversion_rate || 0}%`}
          trend={{ value: kpis?.conversion_rate || 0, isPositive: (kpis?.conversion_rate || 0) > 30 }}
        />
      </div>

      {/* Middle Row: Funnel + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Sales Funnel */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Sales Funnel</h3>
          </div>
          <div className="p-5">
            <SalesFunnel data={funnel || []} />
          </div>
        </div>

        {/* Follow-up Widget */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Follow-ups</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <span className="text-sm text-gray-700">Today</span>
              <span className="text-lg font-bold text-amber-700">{kpis?.followups_today || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg">
              <span className="text-sm text-gray-700">Overdue</span>
              <span className="text-lg font-bold text-rose-700">{kpis?.overdue_followups || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-gray-700">Pending Menus</span>
              <span className="text-lg font-bold text-blue-700">{kpis?.pending_menus || 0}</span>
            </div>
          </div>
        </div>

        {/* Payment Widget */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Payments</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
              <span className="text-sm text-gray-700">Total Sales</span>
              <span className="text-lg font-bold text-emerald-700">{formatCurrency(kpis?.total_sales_value || 0)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <span className="text-sm text-gray-700">Pending Payments</span>
              <span className="text-lg font-bold text-amber-700">{kpis?.pending_payments || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-gray-700">Conversion</span>
              <span className="text-lg font-bold text-blue-700">{kpis?.conversion_rate || 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inquiry Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">All Inquiries</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Pax</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Payment</th>
              </tr>
            </thead>
            <tbody>
              {inquiriesData?.items?.map((inquiry) => (
                <tr key={inquiry.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{inquiry.client_name}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{inquiry.client_phone}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{inquiry.event_type}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{inquiry.pax || "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{inquiry.event_date || "—"}</td>
                  <td className="px-5 py-3.5">
                    <StatusPill
                      label={INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.label || inquiry.status}
                      color={INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.color || "info"}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill
                      label={PAYMENT_STATUSES[inquiry.payment_status as keyof typeof PAYMENT_STATUSES]?.label || inquiry.payment_status}
                      color={PAYMENT_STATUSES[inquiry.payment_status as keyof typeof PAYMENT_STATUSES]?.color || "info"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add Sales Dashboard with funnel, follow-ups, payments"
```

---

### Task 3: Inquiry List Page

**Files:**
- Modify: `frontend/src/pages/inquiries/InquiryList.tsx`
- Create: `frontend/src/pages/inquiries/InquiryDetail.tsx`
- Create: `frontend/src/pages/inquiries/InquiryForm.tsx`
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Build InquiryForm (shared create/edit)**

Create `frontend/src/pages/inquiries/InquiryForm.tsx`:
```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EVENT_TYPES } from "@/lib/constants";
import { Loader2 } from "lucide-react";

const inquirySchema = z.object({
  client_name: z.string().min(1, "Client name is required"),
  client_phone: z.string().min(10, "Phone must be at least 10 digits"),
  event_type: z.string().min(1, "Event type is required"),
  event_date: z.string().optional(),
  pax: z.coerce.number().min(1).optional(),
  budget: z.coerce.number().min(0).optional(),
  follow_up_date: z.string().optional(),
  remarks: z.string().optional(),
});

type InquiryFormData = z.infer<typeof inquirySchema>;

interface InquiryFormProps {
  initialData?: Partial<InquiryFormData>;
  onSubmit: (data: InquiryFormData) => void;
  loading?: boolean;
}

export function InquiryForm({ initialData, onSubmit, loading }: InquiryFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
    defaultValues: initialData,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Client Name *</label>
        <input {...register("client_name")} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm" />
        {errors.client_name && <p className="text-xs text-red-500 mt-1">{errors.client_name.message}</p>}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Phone *</label>
        <input {...register("client_phone")} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm" />
        {errors.client_phone && <p className="text-xs text-red-500 mt-1">{errors.client_phone.message}</p>}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Event Type *</label>
        <select {...register("event_type")} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm">
          <option value="">Select type</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {errors.event_type && <p className="text-xs text-red-500 mt-1">{errors.event_type.message}</p>}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Event Date</label>
        <input {...register("event_date")} type="date" className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Pax (Guests)</label>
        <input {...register("pax")} type="number" className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Budget (₹)</label>
        <input {...register("budget")} type="number" className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Follow-up Date</label>
        <input {...register("follow_up_date")} type="date" className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Remarks</label>
        <input {...register("remarks")} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm" />
      </div>

      <div className="md:col-span-2 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="h-10 px-6 bg-gold hover:bg-gold-hover text-white text-sm font-medium rounded-lg shadow transition-colors flex items-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Inquiry
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Build InquiryList page**

Replace `frontend/src/pages/inquiries/InquiryList.tsx`:
```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInquiries } from "@/hooks/useInquiries";
import { updateInquiryStatus } from "@/api/inquiries";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { InquiryForm } from "./InquiryForm";
import { createInquiry } from "@/api/inquiries";
import { useAuthStore } from "@/store/authStore";
import { INQUIRY_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import { Plus, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

export default function InquiryList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const debouncedSearch = useDebounce(search);

  const { data, isLoading } = useInquiries({
    page,
    per_page: 10,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  });

  const createMutation = useMutation({
    mutationFn: createInquiry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast.success("Inquiry created");
      setShowCreate(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateInquiryStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast.success("Status updated");
    },
  });

  return (
    <div>
      <PageHeader
        title="Inquiries"
        action={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="h-9 px-4 bg-gold hover:bg-gold-hover text-white text-sm font-medium rounded-lg shadow transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> New Inquiry
          </button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full h-9 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-gray-200 text-sm"
        >
          <option value="">All Status</option>
          {Object.entries(INQUIRY_STATUSES).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New Inquiry</h3>
          <InquiryForm
            onSubmit={(data) => createMutation.mutate(data)}
            loading={createMutation.isPending}
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Pax</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-gold mx-auto" /></td></tr>
              ) : data?.items?.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">No inquiries found</td></tr>
              ) : (
                data?.items?.map((inquiry) => (
                  <tr key={inquiry.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{inquiry.client_name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{inquiry.client_phone}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{inquiry.event_type}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{inquiry.pax || "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{inquiry.event_date || "—"}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        label={INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.label || inquiry.status}
                        color={INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.color || "info"}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        label={PAYMENT_STATUSES[inquiry.payment_status as keyof typeof PAYMENT_STATUSES]?.label || inquiry.payment_status}
                        color={PAYMENT_STATUSES[inquiry.payment_status as keyof typeof PAYMENT_STATUSES]?.color || "info"}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => navigate(`/inquiries/${inquiry.id}`)}
                        className="text-xs text-gold hover:underline font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
                className="h-8 px-3 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build InquiryDetail page**

Create `frontend/src/pages/inquiries/InquiryDetail.tsx`:
```tsx
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInquiry, updateInquiryStatus } from "@/api/inquiries";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { INQUIRY_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

const NEXT_STATUS: Record<string, string[]> = {
  new: ["follow_up", "cancelled"],
  follow_up: ["menu_ready", "negotiation", "cancelled"],
  menu_ready: ["presentation_sent", "cancelled"],
  presentation_sent: ["negotiation", "cancelled"],
  negotiation: ["confirmed", "cancelled"],
  confirmed: [],
  cancelled: [],
};

export default function InquiryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: inquiry, isLoading } = useQuery({
    queryKey: ["inquiry", id],
    queryFn: () => getInquiry(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateInquiryStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiry", id] });
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast.success("Status updated");
    },
  });

  if (isLoading || !inquiry) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const nextStatuses = NEXT_STATUS[inquiry.status] || [];

  return (
    <div>
      <PageHeader
        title={`Inquiry — ${inquiry.client_name}`}
        action={
          <button
            onClick={() => navigate("/inquiries")}
            className="h-9 px-4 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Event Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Client Name</p>
              <p className="text-sm font-medium text-gray-900">{inquiry.client_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm font-medium text-gray-900">{inquiry.client_phone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Event Type</p>
              <p className="text-sm font-medium text-gray-900">{inquiry.event_type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Event Date</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(inquiry.event_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pax</p>
              <p className="text-sm font-medium text-gray-900">{inquiry.pax || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Budget</p>
              <p className="text-sm font-medium text-gray-900">
                {inquiry.budget ? formatCurrency(inquiry.budget) : "—"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Remarks</p>
              <p className="text-sm font-medium text-gray-900">{inquiry.remarks || "—"}</p>
            </div>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Status</h3>
          <div className="mb-4">
            <StatusPill
              label={INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.label || inquiry.status}
              color={INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.color || "info"}
            />
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-1">Payment</p>
            <StatusPill
              label={inquiry.payment_status}
              color={inquiry.payment_status === "paid" ? "success" : inquiry.payment_status === "partial" ? "warning" : "danger"}
            />
          </div>

          {inquiry.advance_amount > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500">Advance Paid</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(inquiry.advance_amount)}</p>
            </div>
          )}

          {/* Status Transition Buttons */}
          {nextStatuses.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs text-gray-500 font-medium">Update Status</p>
              {nextStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => statusMutation.mutate(status)}
                  disabled={statusMutation.isPending}
                  className={`w-full h-9 rounded-lg text-sm font-medium transition-colors ${
                    status === "confirmed"
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                      : status === "cancelled"
                      ? "bg-rose-100 hover:bg-rose-200 text-rose-700"
                      : "bg-gold hover:bg-gold-hover text-white"
                  }`}
                >
                  {INQUIRY_STATUSES[status as keyof typeof INQUIRY_STATUSES]?.label || status}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update routes to include InquiryDetail**

Add to `frontend/src/routes/index.tsx`:
```tsx
import InquiryDetail from "@/pages/inquiries/InquiryDetail";
// In the children array:
{ path: "/inquiries/:id", element: <InquiryDetail /> },
```

- [ ] **Step 5: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add Inquiry List, Detail, and Form pages with status transitions"
```

---

## Summary

After completing all 3 tasks:
- **Sales Dashboard** with KPIs, sales funnel, follow-up widget, payment widget, inquiry table
- **Inquiry List** with search, status filter, pagination, create form
- **Inquiry Detail** with full event info, status transition buttons, payment info
- **Inquiry Form** reusable for create/edit with Zod validation
