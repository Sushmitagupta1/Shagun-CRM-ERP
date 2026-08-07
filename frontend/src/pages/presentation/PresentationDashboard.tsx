import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePresentationKPIs } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import { useAuth } from '@/hooks/useAuth'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import { INQUIRY_STATUSES } from '@/lib/constants'
import {
  Presentation,
  Calendar,
  Clock,
  FileImage,
  CheckCircle2,
  Eye,
} from 'lucide-react'

export default function PresentationDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const firstName = user?.full_name?.split(' ')[0] ?? 'Shayank'
  const { data: kpis, isLoading } = usePresentationKPIs()
  const meetings = kpis?.meetings ?? []
  const todayKey = new Date().toLocaleDateString('en-IN')
  const todayMeetings = meetings.filter((m) => new Date(m.meeting_at).toLocaleDateString('en-IN') === todayKey)
  const upcomingMeetings = meetings.filter((m) => new Date(m.meeting_at).toLocaleDateString('en-IN') !== todayKey)
  const { data: inquiriesData } = useInquiries({ per_page: 10 })
  const assignedInquiries = inquiriesData?.items?.filter(
    (i) => i.status !== 'advance_receive' && i.status !== 'operation_handover' && i.status !== 'cancelled'
      && i.presentation_not_required !== true && !i.presentation_file_name
  ) ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader title={`Hi, ${firstName}`} subtitle="Prepare and manage event presentations" />
      </div>

      {/* Top — 3 KPI Cards (wide, with icons) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: 'New Inquiry', value: kpis?.new_inquiry ?? 0, desc: 'New inquiries assigned', icon: Presentation, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', to: '/inquiries' },
              { label: 'Pending Presentations', value: kpis?.pending_presentations ?? 0, desc: 'Awaiting client approval', icon: FileImage, iconBg: 'bg-amber-50', iconColor: 'text-amber-500', to: '/inquiries' },
              { label: 'Meetings Today', value: kpis?.client_meetings_today ?? 0, desc: 'Scheduled client calls', icon: Calendar, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', to: '/reports' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                onClick={() => kpi.to && navigate(kpi.to)}
                className={`flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-md transition-shadow hover:shadow-lg ${kpi.to ? 'cursor-pointer' : ''}`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                  <kpi.icon size={22} className={kpi.iconColor} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{kpi.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                  <p className="text-[11px] text-gray-400">{kpi.desc}</p>
                </div>
              </motion.div>
            ))}
      </div>

      {/* Middle Row — Meetings (4 cols) + Pipeline (4 cols) + Quick Actions (4 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Today's Meetings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-xl border border-gray-100 bg-white shadow-md"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Clock size={14} className="text-amber-500" /> Upcoming Meetings
            </h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {meetings.filter((m) => m.status === 'scheduled').length} pending
            </span>
          </div>
          <div className="space-y-0">
            {meetings.length === 0 && (
              <p className="px-5 py-6 text-center text-xs text-gray-400">No meetings scheduled.</p>
            )}
            {todayMeetings.length > 0 && (
              <>
                <p className="border-b border-gray-100 bg-gray-50 px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Today</p>
                {todayMeetings.map((mtg, i) => {
                  const d = new Date(mtg.meeting_at)
                  const timeStr = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
                  const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  const done = mtg.status === 'completed'
                  return (
                    <motion.div
                      key={mtg.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.06 }}
                      className="flex items-center gap-3 border-b border-gray-50 px-5 py-3 last:border-0"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        done ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {done ? <CheckCircle2 size={14} /> : timeStr.split(':')[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-900">{mtg.client_name}</p>
                        <p className="text-[10px] text-gray-400">{mtg.event_type} · {dateStr} · {timeStr}</p>
                        {mtg.remarks && <p className="truncate text-[10px] text-gray-400">{mtg.remarks}</p>}
                      </div>
                    </motion.div>
                  )
                })}
              </>
            )}
            {upcomingMeetings.length > 0 && (
              <>
                <p className="border-b border-gray-100 bg-gray-50 px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Upcoming</p>
                {upcomingMeetings.map((mtg, i) => {
                  const d = new Date(mtg.meeting_at)
                  const timeStr = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
                  const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  const done = mtg.status === 'completed'
                  return (
                    <motion.div
                      key={mtg.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.06 }}
                      className="flex items-center gap-3 border-b border-gray-50 px-5 py-3 last:border-0"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        done ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {done ? <CheckCircle2 size={14} /> : timeStr.split(':')[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-900">{mtg.client_name}</p>
                        <p className="text-[10px] text-gray-400">{mtg.event_type} · {dateStr} · {timeStr}</p>
                        {mtg.remarks && <p className="truncate text-[10px] text-gray-400">{mtg.remarks}</p>}
                      </div>
                    </motion.div>
                  )
                })}
              </>
            )}
          </div>
        </motion.div>


      </div>

      {/* Bottom Row — Inquiry Details */}
      <div className="grid grid-cols-1 gap-4">
        {/* Inquiry Details Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-bold text-gray-900">Inquiry Details</h3>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Client', 'Event', 'Date', 'Pax', 'Status', ''].map((h) => (
                    <th key={h + Math.random()} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignedInquiries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                      No pending assignments
                    </td>
                  </tr>
                )}
                {assignedInquiries.slice(0, 6).map((inq, i) => (
                  <motion.tr
                    key={inq.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.04 }}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-900">{inq.client_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_date ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.pax ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusPill
                        label={INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.label ?? inq.status}
                        color={INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.color ?? 'bg-gray-100 text-gray-800'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/inquiries/${inq.id}`)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600" title="View">
                        <Eye size={14} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>


      </div>
    </div>
  )
}
