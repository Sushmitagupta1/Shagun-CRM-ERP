import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useSettlements } from '@/hooks/useSettlements'
import { useFinanceKPIs } from '@/hooks/useDashboard'
import { createSettlement, completeSettlement, exportSettlements } from '@/api/settlements'
import { useInquiries } from '@/hooks/useInquiries'
import KPICard from '@/components/common/KPICard'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { formatCurrency } from '@/lib/utils'
import { SETTLEMENT_STATUSES } from '@/lib/constants'
import { toast } from 'sonner'
import { Download, Plus, CheckCircle } from 'lucide-react'

export default function FinancePage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    inquiry_id: '',
    revenue: '',
    vendor_cost: '',
    other_expenses: '',
    notes: '',
  })

  const { data: kpis, isLoading: kpisLoading } = useFinanceKPIs()
  const { data: settlements, isLoading } = useSettlements({ page, per_page: 10 })
  const { data: confirmedInquiries } = useInquiries({ status: 'operation_handover', per_page: 100 })

  const createMutation = useMutation({
    mutationFn: createSettlement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'finance'] })
      toast.success('Settlement created')
      setShowCreate(false)
      setForm({ inquiry_id: '', revenue: '', vendor_cost: '', other_expenses: '', notes: '' })
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed'
      toast.error(message)
    },
  })

  const completeMutation = useMutation({
    mutationFn: completeSettlement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'finance'] })
      toast.success('Settlement completed')
    },
  })

  const handleExport = async () => {
    try {
      await exportSettlements()
      toast.success('Export downloaded')
    } catch {
      toast.error('Export failed')
    }
  }

  if (kpisLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & Settlements"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Export Excel
            </button>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-white shadow transition-colors hover:bg-gold-hover"
            >
              <Plus className="h-4 w-4" /> New Settlement
            </button>
          </div>
        }
      />

      {/* Finance KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KPICard label="Pending Settlements" value={kpis?.pending_settlements ?? 0} />
        <KPICard label="Completed Settlements" value={kpis?.completed_settlements ?? 0} />
        <KPICard label="Total Profit" value={formatCurrency(kpis?.total_profit ?? 0)} />
        <KPICard label="Total Revenue" value={formatCurrency(kpis?.total_revenue ?? 0)} />
        <KPICard label="Total Vendor Cost" value={formatCurrency(kpis?.total_vendor_cost ?? 0)} />
      </div>

      {/* Create Settlement Form */}
      {showCreate && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">New Settlement</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Event (Handed Over) *
              </label>
              <select
                value={form.inquiry_id}
                onChange={(e) => setForm({ ...form, inquiry_id: e.target.value })}
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
              >
                <option value="">Select event</option>
                {confirmedInquiries?.items?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.client_name} — {i.event_type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Revenue (₹) *
              </label>
              <input
                type="number"
                value={form.revenue}
                onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                placeholder="Amount received from customer"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Vendor Cost (₹)
              </label>
              <input
                type="number"
                value={form.vendor_cost}
                onChange={(e) => setForm({ ...form, vendor_cost: e.target.value })}
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                placeholder="Total vendor payments"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Other Expenses (₹)
              </label>
              <input
                type="number"
                value={form.other_expenses}
                onChange={(e) => setForm({ ...form, other_expenses: e.target.value })}
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                placeholder="Transport, labor, misc"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                placeholder="Internal notes"
              />
            </div>
            <div className="flex justify-end md:col-span-2">
              <button
                onClick={() => {
                  if (!form.inquiry_id || !form.revenue) {
                    toast.error('Event and Revenue are required')
                    return
                  }
                  createMutation.mutate({
                    inquiry_id: form.inquiry_id,
                    revenue: Number(form.revenue),
                    vendor_cost: Number(form.vendor_cost) || 0,
                    other_expenses: Number(form.other_expenses) || 0,
                    notes: form.notes || undefined,
                  })
                }}
                disabled={createMutation.isPending}
                className="flex h-10 items-center gap-2 rounded-lg bg-gold px-6 text-sm font-medium text-white shadow transition-colors hover:bg-gold-hover disabled:opacity-50"
              >
                Save Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FnF Summary Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">FnF Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Client Name
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Settlement ID
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Revenue
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Vendor Cost
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Other Expenses
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Net Profit
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-gold border-t-transparent" />
                  </td>
                </tr>
              ) : settlements?.items?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-gray-400">
                    No settlements yet
                  </td>
                </tr>
              ) : (
                settlements?.items?.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">
                      {s.client_name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm text-gray-600">
                      {s.id.slice(0, 8)}...
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                      {formatCurrency(Number(s.revenue))}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {formatCurrency(Number(s.vendor_cost))}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {formatCurrency(Number(s.other_expenses))}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-900">
                      {formatCurrency(Number(s.net_profit))}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        label={
                          SETTLEMENT_STATUSES[s.status as keyof typeof SETTLEMENT_STATUSES]
                            ?.label ?? s.status
                        }
                        color={
                          SETTLEMENT_STATUSES[s.status as keyof typeof SETTLEMENT_STATUSES]
                            ?.color ?? 'bg-gray-100 text-gray-800'
                        }
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      {s.status === 'pending' && (
                        <button
                          onClick={() => completeMutation.mutate(s.id)}
                          disabled={completeMutation.isPending}
                          className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
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
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <p className="text-xs text-gray-500">
              Page {page} of {settlements.total_pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 rounded-lg border border-gray-200 px-3 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(settlements.total_pages, p + 1))}
                disabled={page === settlements.total_pages}
                className="h-8 rounded-lg border border-gray-200 px-3 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
