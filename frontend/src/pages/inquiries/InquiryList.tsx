import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useInquiries } from '@/hooks/useInquiries'
import { createInquiry } from '@/api/inquiries'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { InquiryForm } from './InquiryForm'
import { INQUIRY_STATUSES, PAYMENT_STATUSES } from '@/lib/constants'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'

export default function InquiryList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useInquiries({
    page,
    per_page: 10,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  })

  const createMutation = useMutation({
    mutationFn: createInquiry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      toast.success('Inquiry created')
      setShowCreate(false)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed'
      toast.error(message)
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inquiries"
        action={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-white shadow transition-colors hover:bg-gold-hover"
          >
            <Plus className="h-4 w-4" /> New Inquiry
          </button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="h-9 w-full rounded-lg border border-gray-200 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm"
        >
          <option value="">All Status</option>
          {Object.entries(INQUIRY_STATUSES).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">New Inquiry</h3>
          <InquiryForm
            onSubmit={(data) => createMutation.mutate(data)}
            loading={createMutation.isPending}
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
                  <td colSpan={11} className="px-5 py-8 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-gold border-t-transparent" />
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-8 text-center text-gray-400">
                    No inquiries found
                  </td>
                </tr>
              ) : (
                data?.items?.map((inquiry) => (
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
                      <button
                        onClick={() => navigate(`/inquiries/${inquiry.id}`)}
                        className="text-xs font-medium text-gold hover:underline"
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
