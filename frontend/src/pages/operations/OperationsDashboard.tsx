import { useState } from 'react'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'
import { useOperationsKPIs } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import { useEvents } from '@/hooks/useEvents'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import { uploadInventoryMovementFile } from '@/api/inquiries'
import { toast } from 'sonner'
import {
  Clock,
  Building2,
  Eye,
  Upload,
  FileSpreadsheet,
} from 'lucide-react'
import { getErrorMessage } from '@/lib/apiError'
import { INQUIRY_STATUSES } from '@/lib/constants'

export default function OperationsDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.full_name?.split(' ')[0] ?? 'Operations'
  const { data: kpis, isLoading } = useOperationsKPIs()
  const { data: inquiriesData } = useInquiries({ status: 'operation_handover', per_page: 10 })
  const confirmedEvents = inquiriesData?.items ?? []
  const { data: allInquiriesData } = useInquiries({ per_page: 10 })
  const allInquiries = allInquiriesData?.items ?? []
  const { data: events } = useEvents()
  const todayISO = dayjs().format('YYYY-MM-DD')
  const todaysEvents = events?.filter((e) => e.event_date === todayISO) ?? []
  const [inventoryNames, setInventoryNames] = useState<Record<string, string>>({})
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const handleInventoryUpload = async (inqId: string, file?: File) => {
    if (!file) return
    setUploadingId(inqId)
    try {
      const res = await uploadInventoryMovementFile(inqId, 'received', file)
      setInventoryNames((prev) => ({ ...prev, [inqId]: file.name }))
      toast.success(`Received: ${res.entries_created} entries added`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'))
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Hi, ${firstName}`} subtitle="Manage event execution, vendors, and logistics" />

      {/* Top Row — 5 KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: 'Upcoming Events', value: kpis?.upcoming_events ?? 0, color: 'text-blue-600', to: '/events' },
              { label: "Today's Events", value: kpis?.todays_events ?? 0, color: 'text-amber-600', to: '/events' },
              { label: 'Pending Kitchen Plans', value: kpis?.pending_kitchen_plans ?? 0, color: 'text-rose-600', to: '/events' },
              { label: 'Pending Vendor Requests', value: kpis?.pending_vendor_requests ?? 0, color: 'text-violet-600', to: '/events' },
              { label: 'Pending Warehouse Requests', value: kpis?.pending_warehouse_requests ?? 0, color: 'text-emerald-600', to: '/events' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                onClick={() => navigate(kpi.to)}
                className="cursor-pointer rounded-xl border border-gray-100 bg-white p-4 shadow-md transition-shadow hover:shadow-lg"
                style={{ height: 95 }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{kpi.label}</p>
                <p className={`mt-2 text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              </motion.div>
            ))}
      </div>

      {/* Middle Row — Today's Schedule */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-1">
        {/* Today's Events Schedule */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex rounded-xl border border-gray-100 bg-white p-5 shadow-md"
          style={{ height: 260, flexDirection: 'column' }}
        >
          <h3 className="mb-4 shrink-0 text-sm font-bold text-gray-900">Today's Schedule</h3>
          <div className="flex-1 space-y-3 overflow-y-auto">
            {todaysEvents.length === 0 ? (
              <p className="flex h-full items-center justify-center text-xs text-gray-400">No events scheduled for today.</p>
            ) : (
              todaysEvents.map((evt, i) => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  onClick={() => navigate(`/events/${evt.id}`)}
                  className="cursor-pointer rounded-lg border border-gray-100 bg-white p-3.5 transition-shadow hover:shadow-md"
                  style={{ borderLeft: '4px solid #D97706' }}
                >
                  <p className="text-sm font-bold text-gray-900">{evt.client_name}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={10} /> {evt.event_type}</span>
                    <span className="flex items-center gap-1"><Building2 size={10} /> {evt.venue}</span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row — Upcoming Events Table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-1">
        {/* Recent Events Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="flex overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md"
          style={{ height: 260, flexDirection: 'column' }}
        >
          <div className="shrink-0 border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-bold text-gray-900">Upcoming Events</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Client Name', 'Number', 'Event Type', 'Function Date', 'Pax', 'Remark', 'Actions'].map((h) => (
                    <th key={h + Math.random()} className="bg-gray-50 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confirmedEvents.slice(0, 5).map((inq) => {
                  const inventoryName = inventoryNames[inq.id] ?? inq.inventory_file_name
                  return (
                    <tr key={inq.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-900">{inq.client_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.client_phone ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_type ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_date ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.pax ?? '—'}</td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-xs text-gray-600" title={inq.remarks ?? ''}>{inq.remarks ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/events/${inq.id}`)}
                            className="rounded bg-maroon p-1.5 text-white hover:bg-maroon-dark"
                            title="Open Event View">
                            <Eye size={14} />
                          </button>
                          <label className={`flex cursor-pointer items-center gap-1 rounded p-1 hover:bg-gray-100 hover:text-emerald-600 ${inventoryName ? 'text-emerald-600' : 'text-gray-400'}`} title={inventoryName ? `Inventory excel uploaded: ${inventoryName}` : 'Upload inventory excel'}>
                            {uploadingId === inq.id ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                            ) : (
                              <Upload size={14} />
                            )}
                            <input type="file" className="hidden" accept=".xlsx,.xls,.csv"
                              onChange={(e) => { handleInventoryUpload(inq.id, e.target.files?.[0]); e.target.value = '' }} />
                          </label>
                          {inventoryName && (
                            <FileSpreadsheet size={12} className="text-emerald-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* All Inquiries Table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="flex overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md"
          style={{ height: 300, flexDirection: 'column' }}
        >
          <div className="shrink-0 border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-bold text-gray-900">All Inquiries</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Client Name', 'Number', 'Event Type', 'Function Date', 'Pax', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="bg-gray-50 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allInquiries.map((inq) => (
                  <tr key={inq.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-900">{inq.client_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.client_phone ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_type ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_date ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.pax ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.color ?? 'bg-gray-100 text-gray-700'
                      }`}>
                        {INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.label ?? inq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inq.status === 'operation_handover' && (
                        <button
                          onClick={() => navigate(`/events/${inq.id}`)}
                          className="rounded bg-maroon p-1.5 text-white hover:bg-maroon-dark"
                          title="Open event">
                          <Eye size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
