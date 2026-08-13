import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Eye, CheckCircle2 } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useEvents } from '@/hooks/useEvents'
import { INQUIRY_STATUSES } from '@/lib/constants'

export default function EventList() {
  const navigate = useNavigate()
  const { data: events = [], isLoading } = useEvents()

  return (
    <div className="space-y-5">
      <PageHeader title="Events" subtitle="All operation handover events — click to open Event View" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <CalendarDays size={14} className="text-maroon" /> Event List
          </h3>
          <span className="rounded-full bg-maroon/10 px-2 py-0.5 text-[10px] font-bold text-maroon">{events.length} events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Client Name', 'Event Type', 'Event Date', 'Venue', 'Pax', 'Status', 'Completed', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">Loading events...</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No operation handover events yet.</td></tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-900">{evt.client_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{evt.event_type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{evt.event_date ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{evt.venue ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{evt.pax ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                      {INQUIRY_STATUSES[evt.status as keyof typeof INQUIRY_STATUSES]?.label ?? evt.status}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {evt.is_completed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 size={10} /> Completed
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/events/${evt.id}`)}
                        className="flex items-center gap-1 rounded bg-maroon px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-maroon-dark"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
