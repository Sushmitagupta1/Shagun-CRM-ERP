# Shagun ERP — Plan 6: Frontend Finance & Settlements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Finance & Settlements page for Admin with KPI cards, FnF summary table, settlement create/edit form, and Excel export.

**Architecture:** TanStack Query for settlement data. React Hook Form for settlement create/edit. Recharts for profit chart. Status pill for settlement status.

**Depends on:** Plan 3 (Frontend Foundation) + Plan 5 (common components, hooks, API patterns already established).

---

### Task 1: Settlement API & Hooks

**Files:**
- Create: `frontend/src/api/settlements.ts`
- Create: `frontend/src/hooks/useSettlements.ts`

- [ ] **Step 1: Create settlements API**

Create `frontend/src/api/settlements.ts`:
```ts
import apiClient from "./client";
import type { PaginatedResponse } from "@/types/common";
import type { Settlement, SettlementCreate } from "@/types/settlement";
import type { FinanceKPIs } from "@/types/dashboard";

export async function getSettlements(params: {
  page?: number;
  per_page?: number;
  status?: string;
}): Promise<PaginatedResponse<Settlement>> {
  const response = await apiClient.get("/settlements", { params });
  return response.data;
}

export async function getSettlement(id: string): Promise<Settlement> {
  const response = await apiClient.get(`/settlements/${id}`);
  return response.data;
}

export async function getSettlementByEvent(inquiryId: string): Promise<Settlement> {
  const response = await apiClient.get(`/settlements/event/${inquiryId}`);
  return response.data;
}

export async function createSettlement(data: SettlementCreate): Promise<Settlement> {
  const response = await apiClient.post("/settlements", data);
  return response.data;
}

export async function updateSettlement(id: string, data: Partial<SettlementCreate>): Promise<Settlement> {
  const response = await apiClient.put(`/settlements/${id}`, data);
  return response.data;
}

export async function completeSettlement(id: string): Promise<void> {
  await apiClient.patch(`/settlements/${id}/status`);
}

export async function getFinanceKPIs(): Promise<FinanceKPIs> {
  const response = await apiClient.get("/dashboard/finance");
  return response.data;
}

export async function exportSettlements(): Promise<void> {
  const response = await apiClient.get("/settlements/export/excel", {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "settlements.xlsx");
  document.body.appendChild(link);
  link.click();
  link.remove();
}
```

- [ ] **Step 2: Create useSettlements hook**

Create `frontend/src/hooks/useSettlements.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import * as settlementsApi from "@/api/settlements";

export function useSettlements(params: {
  page?: number;
  per_page?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: ["settlements", params],
    queryFn: () => settlementsApi.getSettlements(params),
  });
}

export function useFinanceKPIs() {
  return useQuery({
    queryKey: ["dashboard", "finance"],
    queryFn: settlementsApi.getFinanceKPIs,
  });
}
```

- [ ] **Step 3: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add settlements API functions and hooks"
```

---

### Task 2: Finance Page

**Files:**
- Modify: `frontend/src/pages/admin/FinancePage.tsx`

- [ ] **Step 1: Build FinancePage**

Replace `frontend/src/pages/admin/FinancePage.tsx`:
```tsx
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useSettlements, useFinanceKPIs } from "@/hooks/useSettlements";
import { createSettlement, completeSettlement, exportSettlements } from "@/api/settlements";
import { KPICard } from "@/components/common/KPICard";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { formatCurrency } from "@/lib/utils";
import { SETTLEMENT_STATUSES } from "@/lib/constants";
import { useInquiries } from "@/hooks/useInquiries";
import { toast } from "sonner";
import { Loader2, Download, Plus, CheckCircle } from "lucide-react";

export default function FinancePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    inquiry_id: "",
    revenue: "",
    vendor_cost: "",
    other_expenses: "",
    notes: "",
  });

  const { data: kpis, isLoading: kpisLoading } = useFinanceKPIs();
  const { data: settlements, isLoading } = useSettlements({ page, per_page: 10 });
  const { data: confirmedInquiries } = useInquiries({ status: "confirmed", per_page: 100 });

  const createMutation = useMutation({
    mutationFn: createSettlement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "finance"] });
      toast.success("Settlement created");
      setShowCreate(false);
      setForm({ inquiry_id: "", revenue: "", vendor_cost: "", other_expenses: "", notes: "" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed"),
  });

  const completeMutation = useMutation({
    mutationFn: completeSettlement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "finance"] });
      toast.success("Settlement completed");
    },
  });

  const handleExport = async () => {
    try {
      await exportSettlements();
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    }
  };

  if (kpisLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Finance & Settlements"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="h-9 px-4 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Export Excel
            </button>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="h-9 px-4 bg-gold hover:bg-gold-hover text-white text-sm font-medium rounded-lg shadow transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> New Settlement
            </button>
          </div>
        }
      />

      {/* Finance KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KPICard label="Pending Settlements" value={kpis?.pending_settlements || 0} />
        <KPICard label="Completed Settlements" value={kpis?.completed_settlements || 0} />
        <KPICard label="Total Profit" value={formatCurrency(kpis?.total_profit || 0)} />
        <KPICard label="Total Revenue" value={formatCurrency(kpis?.total_revenue || 0)} />
        <KPICard label="Total Vendor Cost" value={formatCurrency(kpis?.total_vendor_cost || 0)} />
      </div>

      {/* Create Settlement Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New Settlement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Event (Confirmed Inquiry) *</label>
              <select
                value={form.inquiry_id}
                onChange={(e) => setForm({ ...form, inquiry_id: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
              >
                <option value="">Select event</option>
                {confirmedInquiries?.items?.map((i) => (
                  <option key={i.id} value={i.id}>{i.client_name} — {i.event_type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Revenue (₹) *</label>
              <input
                type="number"
                value={form.revenue}
                onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
                placeholder="Amount received from customer"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Vendor Cost (₹)</label>
              <input
                type="number"
                value={form.vendor_cost}
                onChange={(e) => setForm({ ...form, vendor_cost: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
                placeholder="Total vendor payments"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Other Expenses (₹)</label>
              <input
                type="number"
                value={form.other_expenses}
                onChange={(e) => setForm({ ...form, other_expenses: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
                placeholder="Transport, labor, misc"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
                placeholder="Internal notes"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                onClick={() => {
                  if (!form.inquiry_id || !form.revenue) {
                    toast.error("Event and Revenue are required");
                    return;
                  }
                  createMutation.mutate({
                    inquiry_id: form.inquiry_id,
                    revenue: Number(form.revenue),
                    vendor_cost: Number(form.vendor_cost) || 0,
                    other_expenses: Number(form.other_expenses) || 0,
                    notes: form.notes || undefined,
                  });
                }}
                disabled={createMutation.isPending}
                className="h-10 px-6 bg-gold hover:bg-gold-hover text-white text-sm font-medium rounded-lg shadow transition-colors flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FnF Summary Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">FnF Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Settlement ID</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Revenue</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Vendor Cost</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Other Expenses</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Net Profit</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-gold mx-auto" /></td></tr>
              ) : settlements?.items?.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No settlements yet</td></tr>
              ) : (
                settlements?.items?.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono text-gray-600">{s.id.slice(0, 8)}...</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{formatCurrency(s.revenue)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{formatCurrency(s.vendor_cost)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{formatCurrency(s.other_expenses)}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-900">{formatCurrency(s.net_profit)}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        label={SETTLEMENT_STATUSES[s.status as keyof typeof SETTLEMENT_STATUSES]?.label || s.status}
                        color={SETTLEMENT_STATUSES[s.status as keyof typeof SETTLEMENT_STATUSES]?.color || "info"}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      {s.status === "pending" && (
                        <button
                          onClick={() => completeMutation.mutate(s.id)}
                          disabled={completeMutation.isPending}
                          className="text-xs text-emerald-600 hover:underline font-medium flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" /> Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {settlements && settlements.total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Page {page} of {settlements.total_pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(settlements.total_pages, p + 1))}
                disabled={page === settlements.total_pages}
                className="h-8 px-3 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify Finance page renders**

Navigate to `/finance` while logged in as admin. Should show KPIs and settlement table.

- [ ] **Step 3: Commit**

```bash
cd D:\Shagun CRM\frontend
git add .
git commit -m "feat: add Finance page with settlements KPIs, FnF table, create form, export"
```

---

## Summary

After completing all 2 tasks:
- **Finance page** with 5 KPI cards, settlement create form (event selector, revenue, costs, notes), FnF summary table with status pills, complete action, Excel export
- Settlement API fully connected with TanStack Query
