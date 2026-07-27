import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePresentationKPIs } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import { INQUIRY_STATUSES } from '@/lib/constants'
import { chatMessage } from '@/lib/gemini'
import {
  Presentation,
  Calendar,
  Clock,
  FileImage,
  Upload,
  Palette,
  Phone,
  CheckCircle2,
  Plus,
  MoreVertical,
  ArrowRight,
  Sparkles,
  Eye,
  Bot,
  User,
  Send,
  X,
  Loader2,
  MessageSquare,
} from 'lucide-react'

const themeLibrary = [
  { id: '1', name: 'Royal Wedding', category: 'Wedding', gradient: 'from-rose-600 to-pink-700', used: 12 },
  { id: '2', name: 'Corporate Elegance', category: 'Corporate', gradient: 'from-slate-700 to-slate-900', used: 8 },
  { id: '3', name: 'Birthday Carnival', category: 'Birthday', gradient: 'from-yellow-400 to-amber-500', used: 5 },
  { id: '4', name: 'Garden Party', category: 'Anniversary', gradient: 'from-emerald-500 to-teal-600', used: 3 },
]

const todayMeetings = [
  { id: '1', client: 'Sharma Family', time: '11:00 AM', type: 'Theme Selection', status: 'upcoming' },
  { id: '2', client: 'Tata Corp', time: '2:30 PM', type: 'Final Walkthrough', status: 'upcoming' },
  { id: '3', client: 'Mehta Family', time: '4:00 PM', type: 'Concept Review', status: 'completed' },
]

const presentationPipeline = [
  { stage: 'New Assignment', count: 3, color: 'bg-blue-500' },
  { stage: 'Mood Board', count: 2, color: 'bg-purple-500' },
  { stage: 'Theme Ready', count: 1, color: 'bg-amber-500' },
  { stage: 'Client Approved', count: 0, color: 'bg-emerald-500' },
]

export default function PresentationDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const firstName = user?.full_name?.split(' ')[0] ?? 'Shayank'
  const { data: kpis, isLoading } = usePresentationKPIs()
  const { data: inquiriesData } = useInquiries({ per_page: 10 })
  const assignedInquiries = inquiriesData?.items?.filter(
    (i) => i.status !== 'confirmed' && i.status !== 'cancelled'
  ) ?? []

  // AI Chat
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (chatOpen) inputRef.current?.focus() }, [chatOpen])

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    const res = await chatMessage({ message: userMsg.content, history, context: 'Presentation design and event decor for Shagun Catering' })
    setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: res.error ?? res.text }])
    setIsTyping(false)
  }

  const fmt = (t: string) => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader title={`Hi, ${firstName}`} subtitle="Prepare and manage event presentations" />
        <button onClick={() => setChatOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-maroon px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-maroon-dark hover:shadow-lg">
          <MessageSquare size={16} /> Ask AI
        </button>
      </div>

      {/* Top — 3 KPI Cards (wide, with icons) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: 'Assigned Inquiries', value: kpis?.assigned_inquiries ?? 0, desc: 'Inquiries needing presentations', icon: Presentation, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', to: '/inquiries' },
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
              <Clock size={14} className="text-amber-500" /> Today's Meetings
            </h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {todayMeetings.filter((m) => m.status === 'upcoming').length} pending
            </span>
          </div>
          <div className="space-y-0">
            {todayMeetings.map((mtg, i) => (
              <motion.div
                key={mtg.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="flex items-center gap-3 border-b border-gray-50 px-5 py-3 last:border-0"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  mtg.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  {mtg.status === 'completed' ? <CheckCircle2 size={14} /> : mtg.time.split(':')[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-900">{mtg.client}</p>
                  <p className="text-[10px] text-gray-400">{mtg.type} · {mtg.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Presentation Pipeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md"
        >
          <h3 className="mb-4 text-sm font-bold text-gray-900">Presentation Pipeline</h3>
          <div className="space-y-3">
            {presentationPipeline.map((step, i) => (
              <motion.div
                key={step.stage}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.06 }}
                className="flex items-center gap-3"
              >
                <div className={`h-2 w-2 shrink-0 rounded-full ${step.color}`} />
                <span className="flex-1 text-xs text-gray-600">{step.stage}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700">
                  {step.count}
                </span>
              </motion.div>
            ))}
          </div>
          <button
            onClick={() => toast.info('Opening presentation board...')}
            className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
          >
            View All <ArrowRight size={12} />
          </button>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md"
        >
          <h3 className="mb-4 text-sm font-bold text-gray-900">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'AI Chat', icon: MessageSquare, action: () => setChatOpen(true), color: 'bg-maroon/10 text-maroon' },
              { label: 'Upload Theme', icon: Upload, action: () => toast.success('Theme upload started'), color: 'bg-purple-50 text-purple-600' },
              { label: 'New Meeting', icon: Phone, action: () => toast.info('Schedule meeting'), color: 'bg-blue-50 text-blue-600' },
              { label: 'View Themes', icon: Palette, action: () => toast.info('Opening theme library'), color: 'bg-amber-50 text-amber-600' },
            ].map((act, i) => (
              <motion.button
                key={act.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.06 }}
                whileHover={{ y: -2 }}
                onClick={act.action}
                className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white p-3 text-left transition-colors hover:bg-gray-50"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${act.color}`}>
                  <act.icon size={16} />
                </div>
                <span className="text-[11px] font-semibold text-gray-700">{act.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row — Assigned Inquiries (8 cols) + Theme Library (4 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Assigned Inquiries Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md lg:col-span-8"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-bold text-gray-900">Assigned Inquiries</h3>
            <span className="text-[10px] text-gray-400">{assignedInquiries.length} total</span>
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
                      <div className="flex items-center gap-1">
                        <button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600" title="View">
                          <Eye size={14} />
                        </button>
                        <button className="rounded p-1 text-gray-400 hover:bg-gray-100">
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Theme Library Sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md lg:col-span-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
              <Palette size={14} className="text-purple-500" /> Theme Library
            </h3>
            <button className="rounded-md bg-purple-50 p-1.5 text-purple-600 transition-colors hover:bg-purple-100">
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-2.5">
            {themeLibrary.map((theme, i) => (
              <motion.div
                key={theme.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.06 }}
                className="group flex items-center gap-3 rounded-lg border border-gray-100 p-2.5 transition-colors hover:bg-gray-50"
              >
                <div className={`h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br ${theme.gradient}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-900">{theme.name}</p>
                  <p className="text-[10px] text-gray-400">{theme.category} · Used {theme.used}x</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

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
                    <p className="text-sm font-bold text-gray-900">AI Design Assistant</p>
                    <p className="text-[10px] text-gray-400">Powered by Gemini · Presentation & Decor</p>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="mx-auto max-w-2xl space-y-4">
                  {messages.length === 0 && (
                    <div className="py-12 text-center">
                      <Sparkles size={32} className="mx-auto mb-3 text-maroon/30" />
                      <p className="text-sm font-semibold text-gray-500">Ask me anything about presentations & decor</p>
                      <p className="text-xs text-gray-400">Theme ideas, color schemes, stage setups, and more</p>
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
                  <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about themes, decor, stage design..."
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-maroon focus:bg-white focus:ring-1 focus:ring-maroon focus:outline-none" />
                  <button onClick={handleSend} disabled={!input.trim() || isTyping}
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
