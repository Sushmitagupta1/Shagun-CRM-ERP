import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSalesKPIs, useSalesFunnel } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import { formatCurrency } from '@/lib/utils'
import { INQUIRY_STATUSES } from '@/lib/constants'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { generateInsights, estimateCost, chatMessage } from '@/lib/gemini'
import {
  Calendar,
  Cake,
  PartyPopper,
  Plus,
  CheckCircle,
  Clock,
  TrendingUp,
  Brain,
  Loader2,
  Send,
  Calculator,
  Users,
  Utensils,
  MessageSquare,
  Sparkles,
  X,
  Bot,
  User,
} from 'lucide-react'

const clientReminders = [
  { id: '1', name: 'Priya Sharma', type: 'birthday', date: '2026-07-24', client: 'Priya & Rahul Sharma' },
  { id: '2', name: 'Rahul Sharma', type: 'anniversary', date: '2026-07-24', client: 'Priya & Rahul Sharma' },
  { id: '3', name: 'Mehta Family', type: 'birthday', date: '2026-07-26', client: 'Mehta Family' },
  { id: '4', name: 'Gupta Ji', type: 'anniversary', date: '2026-07-28', client: 'Gupta Wedding' },
]

const funnelStages = [
  { label: 'New', color: '#5A0016' },
  { label: 'Follow Up', color: '#7F1D1D' },
  { label: 'Menu Ready', color: '#991B1B' },
  { label: 'Presentation Sent', color: '#B91C1C' },
  { label: 'Negotiation', color: '#DC2626' },
  { label: 'Confirmed', color: '#10B981' },
  { label: 'Cancelled', color: '#374151' },
]

export default function SalesDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.full_name?.split(' ')[0] ?? 'Sales'
  const { data: kpis, isLoading } = useSalesKPIs()
  const { data: funnel } = useSalesFunnel()
  const { data: inquiriesData } = useInquiries({ page: 1, per_page: 10 })
  const [followUpTab, setFollowUpTab] = useState<'today' | 'upcoming' | 'overdue'>('today')
  const [insightContext, setInsightContext] = useState('Sales pipeline performance and client conversion')
  const [insightResult, setInsightResult] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)

  // Cost Estimator
  const [costInput, setCostInput] = useState({ menu: '', guests: '100', eventType: 'Wedding' })
  const [costResult, setCostResult] = useState('')
  const [costLoading, setCostLoading] = useState(false)

  // AI Chat
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (chatOpen) inputRef.current?.focus() }, [chatOpen])

  const handleChat = async () => {
    if (!chatInput.trim()) return
    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: chatInput.trim() }
    setMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setIsTyping(true)
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    const res = await chatMessage({ message: userMsg.content, history, context: 'Sales pipeline for Shagun Catering ERP' })
    setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: res.error ?? res.text }])
    setIsTyping(false)
  }

  const handleInsight = async () => {
    setInsightLoading(true)
    setInsightResult('')
    const data = `New Inquiries: ${kpis?.new_inquiries ?? 0}, Confirmed: ${kpis?.confirmed ?? 0}, Conversion: ${kpis?.conversion_rate ?? 0}%, Follow-ups Today: ${kpis?.followups_today ?? 0}, Total Sales Value: ${kpis?.total_sales_value ?? 0}`
    const res = await generateInsights({ context: insightContext, data })
    setInsightResult(res.error ?? res.text)
    setInsightLoading(false)
  }

  const fmt = (t: string) => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />')

  const handleEstimateCost = async () => {
    setCostLoading(true)
    setCostResult('')
    const res = await estimateCost(costInput)
    setCostResult(res.error ?? res.text)
    setCostLoading(false)
  }

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
        <button onClick={() => setChatOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-maroon px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-maroon-dark hover:shadow-lg">
          <MessageSquare size={16} /> Ask AI
        </button>
      </div>

      {/* Top Row — 6 KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          { label: 'New Inquiries', value: kpis?.new_inquiries ?? 0, icon: Plus, accent: 'text-blue-600', nav: '/inquiries' },
          { label: 'Follow-ups Today', value: kpis?.followups_today ?? 0, icon: Calendar, accent: 'text-amber-600', nav: '/inquiries' },
          { label: 'Overdue Follow-ups', value: kpis?.overdue_followups ?? 0, icon: Clock, accent: 'text-red-600', urgent: true, nav: '/inquiries' },
          { label: 'Confirmed', value: kpis?.confirmed ?? 0, icon: CheckCircle, accent: 'text-emerald-600', nav: '/reports' },
          { label: 'Total Sales', value: formatCurrency(totalRevenue), icon: TrendingUp, accent: 'text-maroon', nav: '/finance' },
          { label: 'Conversion', value: `${kpis?.conversion_rate ?? 0}%`, icon: TrendingUp, accent: 'text-purple-600', nav: '/reports' },
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

      {/* Middle Row — 3 Columns: Funnel | Follow-ups | Payment Donut */}
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

        {/* Tabbed Follow-Ups Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-xl border border-gray-100 bg-white shadow-md"
          style={{ height: 330 }}
        >
          <div className="flex border-b border-gray-100">
            {(['today', 'upcoming', 'overdue'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFollowUpTab(tab)}
                className={`flex-1 py-3 text-center text-xs font-semibold capitalize transition-colors ${
                  followUpTab === tab
                    ? 'border-b-2 border-gold text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="space-y-2 p-4" style={{ height: 294, overflowY: 'auto' }}>
            {followUpTab === 'today' && (
              <>
                {inquiriesData?.items?.filter((inq) => inq.follow_up_date === new Date().toISOString().slice(0, 10)).slice(0, 5).map((inq) => (
                  <div key={inq.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-900">{inq.client_name}</p>
                      <p className="text-[10px] text-gray-500">{inq.event_type} · {inq.event_date ?? '—'}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">Today</span>
                  </div>
                )) ?? <p className="py-6 text-center text-xs text-gray-400">No follow-ups today</p>}
              </>
            )}
            {followUpTab === 'upcoming' && (
              <>
                {inquiriesData?.items?.filter((inq) => {
                  const fd = inq.follow_up_date
                  return fd && fd > new Date().toISOString().slice(0, 10)
                }).slice(0, 5).map((inq) => (
                  <div key={inq.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-900">{inq.client_name}</p>
                      <p className="text-[10px] text-gray-500">{inq.event_type}</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">{inq.follow_up_date}</span>
                  </div>
                )) ?? <p className="py-6 text-center text-xs text-gray-400">No upcoming follow-ups</p>}
              </>
            )}
            {followUpTab === 'overdue' && (
              <>
                {inquiriesData?.items?.filter((inq) => {
                  const fd = inq.follow_up_date
                  return fd && fd < new Date().toISOString().slice(0, 10)
                }).slice(0, 5).map((inq) => (
                  <div key={inq.id} className="flex items-center justify-between rounded-lg bg-red-50 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-900">{inq.client_name}</p>
                      <p className="text-[10px] text-red-500">Overdue since {inq.follow_up_date}</p>
                    </div>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">Overdue</span>
                  </div>
                )) ?? <p className="py-6 text-center text-xs text-gray-400">No overdue follow-ups</p>}
              </>
            )}
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
      </div>

      {/* Bottom Row — 3 Columns: Banner | Reminders | Table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Next Follow-Up Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-col justify-between rounded-xl border border-blue-100 bg-blue-50/50 p-6 shadow-md"
          style={{ height: 260 }}
        >
          <div>
            <h3 className="text-sm font-bold text-blue-900">Next Follow-Up</h3>
            <p className="mt-1 text-xs text-blue-600">
              {inquiriesData?.items?.find((inq) => inq.follow_up_date && inq.follow_up_date >= new Date().toISOString().slice(0, 10))
                ? `${inquiriesData.items.find((inq) => inq.follow_up_date && inq.follow_up_date >= new Date().toISOString().slice(0, 10))?.client_name} on ${inquiriesData.items.find((inq) => inq.follow_up_date && inq.follow_up_date >= new Date().toISOString().slice(0, 10))?.follow_up_date}`
                : 'No upcoming follow-ups'}
            </p>
          </div>
          <button
            onClick={() => navigate('/inquiries')}
            className="flex h-9 items-center justify-center gap-2 rounded-md bg-gold text-sm font-bold text-white shadow transition-colors hover:bg-gold-hover"
          >
            View Pipeline
          </button>
        </motion.div>

        {/* Client Reminders Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md"
          style={{ height: 260, overflowY: 'auto' }}
        >
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Client Reminders</h3>
          <div className="space-y-2">
            {clientReminders.map((reminder) => (
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
          style={{ height: 260 }}
        >
          <div className="border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Inquiries</h3>
          </div>
          <div className="overflow-y-auto" style={{ height: 226 }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Client</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Event</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Status</th>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* AI Cost Estimation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
        className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Calculator size={16} className="text-maroon" /> AI Cost Estimation
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Menu Description</label>
            <input type="text" value={costInput.menu} onChange={(e) => setCostInput({ ...costInput, menu: e.target.value })} placeholder="e.g. Paneer Tikka, Shahi Paneer, Dal Makhani, Naan..."
              className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs placeholder:text-gray-300 focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500"><Users size={10} /> Guests</label>
            <input type="text" value={costInput.guests} onChange={(e) => setCostInput({ ...costInput, guests: e.target.value })}
              className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500"><Utensils size={10} /> Event Type</label>
            <select value={costInput.eventType} onChange={(e) => setCostInput({ ...costInput, eventType: e.target.value })}
              className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none">
              <option value="Wedding">Wedding</option><option value="Corporate">Corporate</option><option value="Birthday">Birthday</option><option value="Anniversary">Anniversary</option>
            </select>
          </div>
        </div>
        <button onClick={handleEstimateCost} disabled={costLoading}
          className="mt-3 flex h-10 items-center gap-2 rounded-lg bg-maroon px-6 text-xs font-bold text-white shadow hover:bg-maroon-dark disabled:opacity-50">
          {costLoading ? <><Loader2 size={14} className="animate-spin" /> Estimating...</> : <><Calculator size={14} /> Estimate Cost</>}
        </button>
        {costResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-3 max-h-[300px] overflow-y-auto rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-xs leading-relaxed text-gray-700"
            dangerouslySetInnerHTML={{ __html: fmt(costResult) }} />
        )}
      </motion.div>

      {/* AI Insights */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }}
        className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Brain size={16} className="text-maroon" /> AI Sales Insights
        </h3>
        <div className="flex gap-2">
          <input type="text" value={insightContext} onChange={(e) => setInsightContext(e.target.value)} placeholder="What do you want insights on?"
            className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs placeholder:text-gray-300 focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none" />
          <button onClick={handleInsight} disabled={insightLoading}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-maroon px-4 text-xs font-bold text-white shadow hover:bg-maroon-dark disabled:opacity-50">
            {insightLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Analyze
          </button>
        </div>
        {insightResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-3 max-h-[300px] overflow-y-auto rounded-lg border border-purple-200 bg-purple-50/50 p-4 text-xs leading-relaxed text-gray-700"
            dangerouslySetInnerHTML={{ __html: fmt(insightResult) }} />
        )}
      </motion.div>
      {/* AI Chat Modal */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setChatOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-maroon to-maroon-dark">
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">AI Sales Assistant</p>
                    <p className="text-[10px] text-gray-400">Powered by Gemini · Sales Intelligence</p>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="mx-auto max-w-2xl space-y-4">
                  {messages.length === 0 && (
                    <div className="py-12 text-center">
                      <Sparkles size={32} className="mx-auto mb-3 text-maroon/30" />
                      <p className="text-sm font-semibold text-gray-500">Ask me anything about your sales pipeline</p>
                      <p className="text-xs text-gray-400">Client strategies, conversion tips, pricing advice, and more</p>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-maroon to-maroon-dark"><Bot size={16} className="text-white" /></div>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                        msg.role === 'user' ? 'bg-maroon text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`} dangerouslySetInnerHTML={{ __html: fmt(msg.content) }} />
                      {msg.role === 'user' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200"><User size={16} className="text-gray-600" /></div>
                      )}
                    </motion.div>
                  ))}
                  {isTyping && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-maroon to-maroon-dark"><Bot size={16} className="text-white" /></div>
                      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3">
                        <Loader2 size={14} className="animate-spin text-gray-400" /><span className="ml-1 text-xs text-gray-400">Thinking...</span>
                      </div>
                    </motion.div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>
              <div className="border-t border-gray-100 px-5 py-3.5">
                <div className="mx-auto flex max-w-2xl items-center gap-2">
                  <input ref={inputRef} type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                    placeholder="Ask about pricing, conversions, client strategies..."
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-maroon focus:bg-white focus:ring-1 focus:ring-maroon focus:outline-none" />
                  <button onClick={handleChat} disabled={!chatInput.trim() || isTyping}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon text-white shadow hover:bg-maroon-dark disabled:opacity-40"><Send size={16} /></button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
