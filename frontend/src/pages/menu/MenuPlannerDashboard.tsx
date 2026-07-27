import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useMenuPlannerKPIs } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import { useAuth } from '@/hooks/useAuth'
import { createInquiry } from '@/api/inquiries'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import { InquiryForm } from '@/pages/inquiries/InquiryForm'
import { INQUIRY_STATUSES } from '@/lib/constants'
import { generateMenu, chatMessage } from '@/lib/gemini'
import {
  Sparkles,
  Download,
  Leaf,
  DollarSign,
  Users,
  Utensils,
  FileText,
  Send,
  X,
  Bot,
  User,
  Loader2,
  Clock,
  ArrowRight,
  Eye,
  MessageSquare,
  Plus,
} from 'lucide-react'

const menuTemplates = [
  { id: '1', name: 'Rajasthani Thali', category: 'Regional', gradient: 'from-amber-600 to-orange-700', dishes: 14 },
  { id: '2', name: 'Continental Feast', category: 'International', gradient: 'from-emerald-600 to-teal-700', dishes: 12 },
  { id: '3', name: 'South Indian Festive', category: 'Regional', gradient: 'from-yellow-500 to-amber-600', dishes: 10 },
  { id: '4', name: 'Mughlai Royal', category: 'Regional', gradient: 'from-rose-600 to-red-700', dishes: 16 },
]

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function MenuPlannerDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const firstName = user?.full_name?.split(' ')[0] ?? 'Menu Planner'
  const { data: kpis, isLoading } = useMenuPlannerKPIs()
  const { data: inquiriesData } = useInquiries({ per_page: 10 })
  const assignedInquiries = inquiriesData?.items?.filter(
    (i) => i.status !== 'confirmed' && i.status !== 'cancelled'
  ) ?? []

  // Create Inquiry
  const [showCreate, setShowCreate] = useState(false)
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

  // Menu Generator
  const [filters, setFilters] = useState({ season: 'All', budget: '', guests: '', eventType: '' })
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (chatOpen) inputRef.current?.focus() }, [chatOpen])

  // ── AI Menu Generation (Gemini) ──
  const handleGenerate = async () => {
    const { season, budget, guests, eventType } = filters
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `Generate a pure veg menu — Season: ${season}, Budget: ${budget || 'Flexible'}, Guests: ${guests || 'Flexible'}, Event: ${eventType || 'General'}`,
    }
    setMessages([userMsg])
    setChatOpen(true)
    setIsTyping(true)

    const res = await generateMenu({ season, budget, guests, eventType })
    if (res.error) {
      toast.error('AI error: ' + res.error)
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `Sorry, I couldn't generate a menu right now. Error: ${res.error}` }])
    } else {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: res.text }])
    }
    setIsTyping(false)
  }

  // ── AI Chat (Gemini) ──
  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    const history = messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    const res = await chatMessage({ message: userMsg.content, history, context: 'Menu planning for Shagun Catering (pure veg)' })

    if (res.error) {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${res.error}` }])
    } else {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: res.text }])
    }
    setIsTyping(false)
  }

  const formatMessage = (text: string) => text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader title={`Hi, ${firstName}`} subtitle="Create menus, estimate costs, and manage AI-powered suggestions" />
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-gold-hover hover:shadow-lg">
            <Plus size={16} /> New Inquiry
          </button>
          <button onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-maroon px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-maroon-dark hover:shadow-lg">
            <MessageSquare size={16} /> Ask AI
          </button>
        </div>
      </div>

      {/* Top — 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: 'Assigned Inquiries', value: kpis?.assigned_inquiries ?? 0, desc: 'Menus to prepare', icon: FileText, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', to: '/inquiries' },
              { label: 'Pending Menus', value: kpis?.pending_menus ?? 0, desc: 'Awaiting finalization', icon: Clock, iconBg: 'bg-amber-50', iconColor: 'text-amber-500', to: '/inquiries' },
              { label: 'AI Generated', value: kpis?.ai_menus_generated ?? 0, desc: 'Menus via AI', icon: Sparkles, iconBg: 'bg-purple-50', iconColor: 'text-purple-500', to: '/inquiries' },
              { label: 'Templates', value: menuTemplates.length, desc: 'Ready to use', icon: Utensils, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.08 }}
                onClick={() => kpi.to && navigate(kpi.to)}
                className={`flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-md transition-shadow hover:shadow-lg ${kpi.to ? 'cursor-pointer' : ''}`}>
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

      {/* Create Inquiry Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">New Inquiry</h3>
                <button onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={18} /></button>
              </div>
              <InquiryForm
                onSubmit={(data) => createMutation.mutate(data)}
                loading={createMutation.isPending}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Middle Row — AI Menu (7 cols) + Templates (5 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* AI Menu Generator */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md lg:col-span-7">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
            <Sparkles size={16} className="text-amber-500" /> AI Menu Generator
          </h3>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500"><Leaf size={10} /> Season</label>
                <select value={filters.season} onChange={(e) => setFilters({ ...filters, season: e.target.value })}
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:border-maroon focus:ring-1 focus:ring-maroon focus:outline-none">
                  <option value="All">All</option><option value="Winter">Winter</option><option value="Summer">Summer</option><option value="Monsoon">Monsoon</option>
                </select>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500"><DollarSign size={10} /> Budget</label>
                <input type="text" value={filters.budget} onChange={(e) => setFilters({ ...filters, budget: e.target.value })} placeholder="e.g. ₹500-800"
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs placeholder:text-gray-300 focus:border-maroon focus:ring-1 focus:ring-maroon focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500"><Users size={10} /> Guests</label>
                <input type="text" value={filters.guests} onChange={(e) => setFilters({ ...filters, guests: e.target.value })} placeholder="e.g. 150"
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs placeholder:text-gray-300 focus:border-maroon focus:ring-1 focus:ring-maroon focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500"><Utensils size={10} /> Event Type</label>
                <select value={filters.eventType} onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:border-maroon focus:ring-1 focus:ring-maroon focus:outline-none">
                  <option value="">All</option><option value="Wedding">Wedding</option><option value="Corporate">Corporate</option><option value="Birthday">Birthday</option><option value="Anniversary">Anniversary</option>
                </select>
              </div>
            </div>
            <button onClick={handleGenerate} disabled={isTyping}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-maroon text-sm font-bold text-white shadow transition-colors hover:bg-maroon-dark disabled:opacity-50">
              {isTyping ? <><Loader2 size={15} className="animate-spin" /> Generating...</> : <><Sparkles size={15} /> Generate AI Menu</>}
            </button>
          </div>
        </motion.div>

        {/* Menu Templates */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md lg:col-span-5">
          <h3 className="mb-3 text-sm font-bold text-gray-900">Menu Templates</h3>
          <div className="space-y-2">
            {menuTemplates.map((tpl, i) => (
              <motion.div key={tpl.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.06 }}
                className="group flex items-center gap-3 rounded-lg border border-gray-100 p-2.5 transition-colors hover:bg-gray-50">
                <div className={`h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br ${tpl.gradient}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-900">{tpl.name}</p>
                  <p className="text-[10px] text-gray-400">{tpl.category} · {tpl.dishes} dishes</p>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row — Assigned Inquiries (8 cols) + Export (4 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
          className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md lg:col-span-8">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-bold text-gray-900">Menus to Prepare</h3>
            <span className="text-[10px] text-gray-400">{assignedInquiries.length} pending</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Client', 'Event', 'Date', 'Pax', 'Status', ''].map((h) => (
                    <th key={h + Math.random()} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignedInquiries.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No pending menus</td></tr>}
                {assignedInquiries.slice(0, 5).map((inq, i) => (
                  <motion.tr key={inq.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.04 }}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-900">{inq.client_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_date ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.pax ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusPill label={INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.label ?? inq.status}
                        color={INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.color ?? 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="px-4 py-3"><button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"><Eye size={14} /></button></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-6 text-center shadow-md lg:col-span-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon/10">
            <FileText size={24} className="text-maroon" />
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-900">Export Menu Report</p>
          <p className="mt-1 text-[11px] text-gray-400">Download menu history and templates</p>
          <button onClick={() => toast.success('Menu report exported')}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-maroon text-sm font-bold text-white shadow transition-colors hover:bg-maroon-dark">
            <Download size={15} /> Download
          </button>
        </motion.div>
      </div>

      {/* ===== AI Chat Modal ===== */}
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
                    <p className="text-sm font-bold text-gray-900">AI Menu Assistant</p>
                    <p className="text-[10px] text-gray-400">Powered by Gemini · Pure Veg Catering</p>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="mx-auto max-w-2xl space-y-4">
                  {messages.map((msg) => (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-maroon to-maroon-dark"><Bot size={16} className="text-white" /></div>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                        msg.role === 'user' ? 'bg-gold text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`} dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
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
                    placeholder="Ask about menus, costs, ingredients..."
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-maroon focus:bg-white focus:ring-1 focus:ring-maroon focus:outline-none" />
                  <button onClick={handleSend} disabled={!input.trim() || isTyping}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon text-white shadow hover:bg-maroon-dark disabled:opacity-40"><Send size={16} /></button>
                </div>
                <p className="mt-2 text-center text-[10px] text-gray-300">AI suggestions are indicative. Finalize with your chef.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
