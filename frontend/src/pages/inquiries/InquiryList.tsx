import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useInquiries } from '@/hooks/useInquiries'
import { useAuth } from '@/hooks/useAuth'
import { createInquiry, updateInquiry, exportInquiriesExcel } from '@/api/inquiries'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { InquiryForm } from './InquiryForm'
import { INQUIRY_STATUSES, PAYMENT_STATUSES, EVENT_TYPES } from '@/lib/constants'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Eye, X } from 'lucide-react'

export default function InquiryList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const role = user?.role.name ?? ''
  const isMenuPlanner = role === 'menu_planner'
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [followupFilter, setFollowupFilter] = useState(searchParams.get('followup') ?? '')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [exporting, setExporting] = useState(false)
  const debouncedSearch = useDebounce(search)

  const filterParams = {
    page,
    per_page: 10,
    status: statusFilter || undefined,
    followup: followupFilter || undefined,
    search: debouncedSearch || undefined,
    event_type: eventTypeFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }

  const { data, isLoading } = useInquiries(filterParams)

  const createMutation = useMutation({
    mutationFn: createInquiry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      setPage(1)
      toast.success('Inquiry created')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed'
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateInquiry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      setPage(1)
      toast.success('Inquiry saved')
      setShowCreate(false)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Update failed'
      toast.error(message)
    },
  })

  const handleExportExcel = useCallback(async () => {
    setExporting(true)
    try {
      await exportInquiriesExcel({
        status: filterParams.status,
        search: filterParams.search,
        event_type: filterParams.event_type,
        date_from: filterParams.date_from,
        date_to: filterParams.date_to,
      })
      toast.success('Excel exported')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }, [filterParams])

  const handleExportPDF = useCallback(() => {
    if (!data?.items?.length) {
      toast.error('No data to export')
      return
    }
    const rows = data.items.map((i) => `
      <tr>
        <td>${i.client_name}</td>
        <td>${i.client_phone || '—'}</td>
        <td>${i.event_type}</td>
        <td>${i.pax ?? '—'}</td>
        <td>${i.per_plate_rate ? formatCurrency(Number(i.per_plate_rate)) : '—'}</td>
        <td>${i.add_on ? formatCurrency(i.add_on) : '—'}</td>
        <td>${i.total_amount ? formatCurrency(i.total_amount) : '—'}</td>
        <td>${i.inquiry_date ?? '—'}</td>
        <td>${i.event_date ?? '—'}</td>
        <td>${INQUIRY_STATUSES[i.status as keyof typeof INQUIRY_STATUSES]?.label ?? i.status}</td>
        <td>${PAYMENT_STATUSES[i.payment_status as keyof typeof PAYMENT_STATUSES]?.label ?? i.payment_status}</td>
      </tr>
    `).join('')
    const html = `<html><head><style>table { width:100%; border-collapse:collapse; font-family:Arial; font-size:12px; } th,td { border:1px solid #ccc; padding:6px 8px; text-align:left; } th { background:#5A0016; color:#fff; }</style></head><body><h2>Inquiries Report</h2><table><thead><tr><th>Client</th><th>Phone</th><th>Event</th><th>Pax</th><th>Rate</th><th>Add On</th><th>Total</th><th>Inquiry Date</th><th>Event Date</th><th>Status</th><th>Payment</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.print()
    }
  }, [data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inquiries"
        action={
          !isMenuPlanner && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-white shadow transition-colors hover:bg-gold-hover"
            >
              <Plus className="h-4 w-4" /> New Inquiry
            </button>
          )
        }
      />

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">

          <div className="relative max-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone..."
              className="h-9 w-full rounded-lg border border-gray-200 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm"
          >
            <option value="">All Status</option>
            {Object.entries(INQUIRY_STATUSES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={eventTypeFilter}
            onChange={(e) => { setEventTypeFilter(e.target.value); setPage(1) }}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm"
          >
            <option value="">All Events</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm"
            title="Inquiry date from"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm"
            title="Inquiry date to"
          />
        </div>
        {followupFilter && (
          <div className="flex items-center gap-2">
            <span className="flex h-7 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700">
              {followupFilter === 'today' ? "Today's Follow-ups" : 'Overdue Follow-ups'}
              <button
                onClick={() => { setFollowupFilter(''); setPage(1) }}
                className="ml-1 rounded p-0.5 hover:bg-amber-100"
                title="Clear filter"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <FileSpreadsheet size={14} /> {exporting ? 'Exporting...' : 'Excel'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!data?.items?.length}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">New Inquiry</h3>
          <InquiryForm
            onStage1Submit={async (data) => {
              const created = await createMutation.mutateAsync(data)
              return created.id
            }}
            onStage2Submit={async (id, data) => {
              await updateMutation.mutateAsync({ id, data })
            }}
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Client
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Phone
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Event
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Pax
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Per Plate Rate
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Add On
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Total Amount
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Inquiry Date
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Function Date
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Payment
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-5 py-8 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-gold border-t-transparent" />
                  </td>
                </tr>
              ) : (data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-5 py-8 text-center text-gray-400">
                    No inquiries found
                  </td>
                </tr>
              ) : (
                (data?.items ?? []).map((inquiry) => (
                  <tr
                    key={inquiry.id}
                    className="border-b border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                      {inquiry.client_name}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {inquiry.client_phone}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {inquiry.event_type}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {inquiry.pax ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {inquiry.per_plate_rate ? formatCurrency(Number(inquiry.per_plate_rate)) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {inquiry.add_on ? formatCurrency(inquiry.add_on) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {inquiry.total_amount ? formatCurrency(inquiry.total_amount) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {inquiry.inquiry_date ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {inquiry.event_date ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        label={
                          INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]
                            ?.label ?? inquiry.status
                        }
                        color={
                          INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]
                            ?.color ?? 'bg-gray-100 text-gray-800'
                        }
                      />
                      {inquiry.menu_content && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Menu Ready
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        label={
                          PAYMENT_STATUSES[
                            inquiry.payment_status as keyof typeof PAYMENT_STATUSES
                          ]?.label ?? inquiry.payment_status
                        }
                        color={
                          PAYMENT_STATUSES[
                            inquiry.payment_status as keyof typeof PAYMENT_STATUSES
                          ]?.color ?? 'bg-gray-100 text-gray-800'
                        }
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => navigate(`/inquiries/${inquiry.id}`)}
                          className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2 text-[10px] font-medium text-gray-600 hover:bg-gray-50">
                          <Eye size={12} /> View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 rounded-lg border border-gray-200 px-3 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
                className="h-8 rounded-lg border border-gray-200 px-3 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
