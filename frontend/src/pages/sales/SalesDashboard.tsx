import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSalesKPIs, useSalesFunnel } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import { formatCurrency } from '@/lib/utils'
import { INQUIRY_STATUSES } from '@/lib/constants'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { updateInquiry } from '@/api/inquiries'
import { toast } from 'sonner'
import {
  Calendar,
  Cake,
  PartyPopper,
  Plus,
  CheckCircle,
  Clock,
  TrendingUp,
  Loader2,
  X,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'

function getUpcomingReminders(inquiries: { id: string; client_name: string; birthday_date: string | null; anniversary_date: string | null }[]) {
  const today = new Date()
  const in15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)
  const reminders: { id: string; name: string; type: string; date: string; client: string }[] = []
  for (const i of inquiries) {
    if (i.birthday_date) {
      const d = new Date(i.birthday_date)
      d.setFullYear(today.getFullYear())
      if (d >= today && d <= in15Days) {
        reminders.push({ id: `${i.id}-bday`, name: i.client_name, type: 'birthday', date: i.birthday_date, client: i.client_name })
      }
    }
    if (i.anniversary_date) {
      const d = new Date(i.anniversary_date)
      d.setFullYear(today.getFullYear())
      if (d >= today && d <= in15Days) {
        reminders.push({ id: `${i.id}-anniv`, name: i.client_name, type: 'anniversary', date: i.anniversary_date, client: i.client_name })
      }
    }
  }
  return reminders
}

const funnelStages = [
  { label: 'New Inquiry', color: '#5A0016' },
  { label: 'Follow Up', color: '#7F1D1D' },
  { label: 'Menu Sent', color: '#991B1B' },
  { label: 'Client Confirmation', color: '#B91C1C' },
  { label: 'Advance Receive', color: '#10B981' },
  { label: 'Operation Handover', color: '#14B8A6' },
]

export default function SalesDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const firstName = user?.full_name?.split(' ')[0] ?? 'Sales'
  const role = user?.role.name ?? ''
  const canManageReminders = role === 'admin' || role === 'sales_head'
  const { data: kpis, isLoading } = useSalesKPIs()
  const { data: funnel } = useSalesFunnel()
  const { data: inquiriesData } = useInquiries({ page: 1, per_page: 10 })
  const { data: allInquiriesData } = useInquiries({ page: 1, per_page: 100 })
  // Reminder modal
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderClientId, setReminderClientId] = useState('')
  const [reminderType, setReminderType] = useState<'birthday' | 'anniversary'>('birthday')
  const [reminderDate, setReminderDate] = useState('')
  const reminderMutation = useMutation({
    mutationFn: ({ id, type, date }: { id: string; type: 'birthday' | 'anniversary'; date: string }) =>
      updateInquiry(id, type === 'birthday' ? { birthday_date: date } : { anniversary_date: date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      toast.success('Reminder saved')
      setShowReminderModal(false)
      setReminderClientId('')
      setReminderType('birthday')
      setReminderDate('')
    },
    onError: () => toast.error('Failed to save reminder'),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Hi, ${firstName}`} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  const totalRevenue = kpis?.total_sales_value ?? 0
  const paidPct = totalRevenue > 0 ? 40 : 0
  const partialPct = totalRevenue > 0 ? 25 : 0
  const pendingPct = totalRevenue > 0 ? 35 : 0
  const maxFunnel = Math.max(...(funnel?.map((f) => f.count) ?? [1]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={`Hi, ${firstName}`} subtitle="Manage your complete sales pipeline" />
      </div>

      {/* Top Row — 6 KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          { label: 'Total Inquiries', value: kpis?.total_inquiries ?? 0, icon: Plus, accent: 'text-blue-600', nav: '/inquiries' },
          { label: 'Upcoming Follow-ups', value: kpis?.upcoming_followups ?? 0, icon: Calendar, accent: 'text-amber-600', nav: '/inquiries?followup=upcoming' },
          { label: 'Overdue Follow-ups', value: kpis?.overdue_followups ?? 0, icon: Clock, accent: 'text-red-600', urgent: true, nav: '/inquiries?followup=overdue' },
          { label: 'Pending Payment', value: kpis?.pending_payments ?? 0, icon: Wallet, accent: 'text-amber-600', nav: '/finance' },
          { label: 'Total Sales', value: formatCurrency(totalRevenue), icon: TrendingUp, accent: 'text-maroon', nav: '/finance' },
          { label: 'Pending Menu', value: kpis?.pending_menus ?? 0, icon: UtensilsCrossed, accent: 'text-purple-600', nav: '/inquiries' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            className="cursor-pointer rounded-xl border border-gray-100 bg-white p-4 shadow-md transition-shadow hover:shadow-lg"
            style={{ height: 95 }}
            onClick={() => navigate(kpi.nav)}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{kpi.label}</p>
            <div className="mt-2 flex items-end justify-between">
              <span className={`text-2xl font-bold tabular-nums ${kpi.urgent ? 'text-red-600' : 'text-gray-900'}`}>
                {kpi.value}
              </span>
              <kpi.icon size={18} className={kpi.accent} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Middle Row — 3 Columns: Funnel | Payment Donut | Next Follow-Up */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Inquiry Pipeline Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md"
          style={{ height: 330 }}
        >
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Inquiry Pipeline</h3>
          <div className="flex flex-col gap-2">
            {funnelStages.map((stage, i) => {
              const count = funnel?.find((f) => f.stage === stage.label)?.count ?? 0
              const pct = maxFunnel > 0 ? (count / maxFunnel) * 100 : 0
              return (
                <motion.div
                  key={stage.label}
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: 0.4 + i * 0.06, duration: 0.4 }}
                  style={{ transformOrigin: 'left' }}
                  className="flex items-center gap-3"
                >
                  <div
                    className="flex h-7 items-center justify-center rounded-md px-2 text-[10px] font-bold text-white"
                    style={{ backgroundColor: stage.color, minWidth: 90 }}
                  >
                    {stage.label}
                  </div>
                  <div className="flex-1 overflow-hidden rounded-full bg-gray-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.5 + i * 0.06, duration: 0.6 }}
                      className="h-5 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-bold text-gray-700">{count}</span>
                </motion.div>
              )
            })}
          </div>
        </motion.div>



        {/* Payment Overview Donut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-5 shadow-md"
          style={{ height: 330 }}
        >
          <h3 className="mb-4 self-start text-sm font-semibold text-gray-900">Payment Overview</h3>
          <div className="relative" style={{ width: 180, height: 180 }}>
            <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
              <circle cx="90" cy="90" r="70" fill="none" stroke="#E5E7EB" strokeWidth="20" />
              <circle cx="90" cy="90" r="70" fill="none" stroke="#10B981" strokeWidth="20"
                strokeDasharray={`${(paidPct / 100) * 440} 440`} strokeDashoffset="0" />
              <circle cx="90" cy="90" r="70" fill="none" stroke="#F59E0B" strokeWidth="20"
                strokeDasharray={`${(partialPct / 100) * 440} 440`} strokeDashoffset={`${-(paidPct / 100) * 440}`} />
              <circle cx="90" cy="90" r="70" fill="none" stroke="#EF4444" strokeWidth="20"
                strokeDasharray={`${(pendingPct / 100) * 440} 440`} strokeDashoffset={`${-((paidPct + partialPct) / 100) * 440}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-gray-900">{formatCurrency(totalRevenue)}</span>
              <span className="text-[10px] text-gray-400">Total Revenue</span>
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            {[
              { label: 'Paid', color: '#10B981', pct: paidPct },
              { label: 'Partial', color: '#F59E0B', pct: partialPct },
              { label: 'Pending', color: '#EF4444', pct: pendingPct },
            ].map((seg) => (
              <div key={seg.label} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-[10px] font-medium text-gray-600">{seg.label} {seg.pct}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Menu Due Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-col justify-between rounded-xl border border-amber-100 bg-amber-50/50 p-6 shadow-md"
          style={{ height: 330 }}
        >
          <div className="flex min-h-0 flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-900">Menu Due</h3>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {(kpis?.pending_menus_list ?? []).length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {(kpis?.pending_menus_list ?? []).length === 0 ? (
                <p className="py-4 text-center text-xs text-amber-600">No menus due</p>
              ) : (
                (kpis?.pending_menus_list ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/inquiries/${p.id}`)}
                    className="flex w-full items-start gap-3 rounded-lg border border-amber-100 bg-white p-3 text-left transition-colors hover:border-amber-300"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-700">
                      <UtensilsCrossed size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-gray-900">{p.client_name}</p>
                      <p className="truncate text-[10px] text-gray-500">
                        {p.event_type}
                        {p.event_date ? ` · ${new Date(p.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          <button
            onClick={() => navigate('/inquiries')}
            className="mt-3 flex h-9 items-center justify-center gap-2 rounded-md bg-gold text-sm font-bold text-white shadow transition-colors hover:bg-gold-hover"
          >
            View Pipeline
          </button>
        </motion.div>
      </div>

      {/* Bottom Row — 2 Columns: Reminders | Table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Client Reminders Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md"
          style={{ height: 260, overflowY: 'auto' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Client Reminders</h3>
            {canManageReminders && (
              <button onClick={() => setShowReminderModal(true)}
                className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-50">
                <Plus size={12} /> Add Reminder
              </button>
            )}
          </div>
          <div className="space-y-2">
            {getUpcomingReminders(inquiriesData?.items ?? []).map((reminder) => (
              <div key={reminder.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2.5 transition-colors hover:bg-gray-100">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  reminder.type === 'birthday' ? 'bg-pink-100' : 'bg-purple-100'
                }`}>
                  {reminder.type === 'birthday' ? (
                    <Cake size={16} className="text-pink-600" />
                  ) : (
                    <PartyPopper size={16} className="text-purple-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900">{reminder.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {reminder.type === 'birthday' ? 'Birthday' : 'Anniversary'} · {reminder.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Inquiries Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md"
          style={{ height: 260, display: 'flex', flexDirection: 'column' }}
        >
          <div className="shrink-0 border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Inquiries</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="bg-gray-50 px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Client</th>
                  <th className="bg-gray-50 px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Event</th>
                  <th className="bg-gray-50 px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {inquiriesData?.items?.slice(0, 6).map((inq) => (
                  <tr key={inq.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-gray-900">{inq.client_name}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-600">{inq.event_type}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <StatusPill
                        label={INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.label ?? inq.status}
                        color={INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.color ?? 'bg-gray-100 text-gray-800'}
                      />
                      {inq.menu_content && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Menu Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Upcoming Follow-ups Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.85 }}
        className="rounded-xl border border-gray-100 bg-white p-5 shadow-md"
        style={{ height: 260, display: 'flex', flexDirection: 'column' }}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Calendar size={15} className="text-amber-600" /> Upcoming Follow-ups
          </h3>
          <button
            onClick={() => navigate('/inquiries?followup=upcoming')}
            className="flex h-8 items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            View all
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
        {kpis?.upcoming_followups_list?.length ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {kpis.upcoming_followups_list.map((fu) => (
              <button
                key={fu.id}
                onClick={() => navigate(`/inquiries/${fu.inquiry_id}`)}
                className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-left transition-colors hover:border-amber-200 hover:bg-amber-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                  {new Date(fu.follow_up_date).getDate()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-gray-900">{fu.client_name}</p>
                  <p className="truncate text-[10px] text-gray-500">{fu.event_type}</p>
                  {fu.remarks && <p className="mt-0.5 line-clamp-2 text-[10px] italic text-gray-400">"{fu.remarks}"</p>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-gray-400">No upcoming follow-ups scheduled.</p>
        )}
        </div>
      </motion.div>

      {/* Meetings Panel — scheduled & completed meetings (Vinod overview) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
        className="rounded-xl border border-gray-100 bg-white p-5 shadow-md"
        style={{ height: 260, display: 'flex', flexDirection: 'column' }}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Clock size={15} className="text-blue-600" /> Meetings
          </h3>
          <button
            onClick={() => navigate('/calendar')}
            className="flex h-8 items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            View calendar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
        {kpis?.meetings?.length ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {kpis.meetings.map((mtg) => {
              const d = new Date(mtg.meeting_at)
              const done = mtg.status === 'completed'
              return (
                <button
                  key={mtg.id}
                  onClick={() => mtg.inquiry_id && navigate(`/inquiries/${mtg.inquiry_id}`)}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-700'}`}>
                    {done ? <CheckCircle size={13} /> : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-gray-900">{mtg.client_name}</p>
                    <p className="truncate text-[10px] text-gray-500">
                      {mtg.event_type} · {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {mtg.remarks && <p className="mt-0.5 line-clamp-2 text-[10px] italic text-gray-400">"{mtg.remarks}"</p>}
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {done ? 'Completed' : 'Scheduled'}
                      </span>
                      {mtg.created_by_name && (
                        <span className="truncate text-[9px] text-gray-400">by {mtg.created_by_name}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-gray-400">No meetings scheduled.</p>
        )}
        </div>
      </motion.div>


      {/* Add Reminder Modal */}
      <AnimatePresence>
        {showReminderModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setShowReminderModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Add Client Reminder</h3>
                  <p className="text-[11px] text-gray-400">Set birthday or anniversary for a client</p>
                </div>
                <button onClick={() => setShowReminderModal(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Client *</label>
                  <select value={reminderClientId} onChange={(e) => setReminderClientId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-gray-200 px-2 text-sm">
                    <option value="">Select client…</option>
                    {(allInquiriesData?.items ?? []).map((inq) => (
                      <option key={inq.id} value={inq.id}>{inq.client_name} ({inq.event_type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Type *</label>
                  <div className="flex gap-2">
                    {(['birthday', 'anniversary'] as const).map((t) => (
                      <button key={t} onClick={() => setReminderType(t)}
                        className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                          reminderType === t
                            ? t === 'birthday'
                              ? 'border-pink-300 bg-pink-50 text-pink-700'
                              : 'border-purple-300 bg-purple-50 text-purple-700'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}>
                        {t === 'birthday' ? <Cake size={14} /> : <PartyPopper size={14} />}
                        {t === 'birthday' ? 'Birthday' : 'Anniversary'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Date *</label>
                  <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-gray-200 px-2 text-sm" />
                </div>
                <button
                  onClick={() => reminderMutation.mutate({ id: reminderClientId, type: reminderType, date: reminderDate })}
                  disabled={!reminderClientId || !reminderDate || reminderMutation.isPending}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-maroon text-sm font-bold text-white transition-colors hover:bg-maroon-dark disabled:opacity-50"
                >
                  {reminderMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Save Reminder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
