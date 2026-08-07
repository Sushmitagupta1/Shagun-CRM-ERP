import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAdminKPIs, useMonthlyTrend, useConversionRate } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import KPICard from '@/components/common/KPICard'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { ConversionRate } from '@/components/charts/ConversionRate'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import { formatCurrency } from '@/lib/utils'
import { INQUIRY_STATUSES } from '@/lib/constants'
import { useAuth } from '@/hooks/useAuth'
import { generateReport, chatMessage } from '@/lib/gemini'
import { Loader2, FileText, Send, MessageSquare, X, Bot, User, Sparkles, Eye } from 'lucide-react'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const firstName = user?.full_name?.split(' ')[0] ?? 'Admin'
  const { data: kpis, isLoading: kpisLoading } = useAdminKPIs()
  const { data: trend } = useMonthlyTrend()
  const { data: conversion } = useConversionRate()
  const { data: inquiriesData, isLoading: inquiriesLoading } = useInquiries({ page: 1, per_page: 5 })

  // AI Reports
  const [reportType, setReportType] = useState('Sales Summary')
  const [reportResult, setReportResult] = useState('')
  const [reportLoading, setReportLoading] = useState(false)

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
    const res = await chatMessage({ message: userMsg.content, history, context: 'Admin dashboard for Shagun Catering ERP' })
    setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: res.error ?? res.text }])
    setIsTyping(false)
  }

  const handleGenerateReport = async () => {
    setReportLoading(true)
    setReportResult('')
    const data = `Total Inquiries: ${kpis?.total_inquiries ?? 0}, Confirmed: ${kpis?.confirmed ?? 0}, Revenue: ${formatCurrency(kpis?.total_revenue ?? 0)}, Outstanding: ${formatCurrency(kpis?.outstanding_amount ?? 0)}`
    const res = await generateReport({ type: reportType, data, period: 'this month' })
    setReportResult(res.error ?? res.text)
    setReportLoading(false)
  }

  const fmt = (t: string) => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={`Hi, ${firstName}`} subtitle="Welcome back — here's your business overview" />
        <button onClick={() => setChatOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-maroon px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-maroon-dark hover:shadow-lg">
          <MessageSquare size={16} /> Ask AI
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpisLoading
          ? Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: 'Total Inquiries', value: kpis?.total_inquiries ?? 0, onClick: () => navigate('/inquiries') },
              { label: 'Confirmed Events', value: kpis?.confirmed ?? 0, onClick: () => navigate('/inquiries') },
              { label: 'Pending Payments', value: kpis?.pending_payments ?? 0, onClick: () => navigate('/finance') },
              { label: 'Upcoming Events', value: kpis?.upcoming_events ?? 0, onClick: () => navigate('/inquiries') },
              { label: "Today's Events", value: kpis?.today_events ?? 0, onClick: () => navigate('/inquiries') },
              { label: 'Total Revenue', value: formatCurrency(kpis?.total_revenue ?? 0), onClick: () => navigate('/finance') },
            ].map((kpi, i) => (
              <KPICard key={kpi.label} label={kpi.label} value={kpi.value} index={i} />
            ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[
          { title: 'Inquiry Distribution', child: <ConversionRate data={conversion ?? []} /> },
          { title: 'Inquiry Volume', child: <RevenueChart data={trend ?? []} /> },
        ].map((chart, i) => (
          <motion.div
            key={chart.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
            className="rounded-xl border border-gray-100 bg-white shadow-md"
          >
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">{chart.title}</h3>
            </div>
            <div className="p-5">{chart.child}</div>
          </motion.div>
        ))}
      </div>

      {/* AI Reports */}
      <div className="grid grid-cols-1 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
            <FileText size={16} className="text-maroon" /> AI Reports
          </h3>
          <div className="flex gap-2">
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none">
              <option>Sales Summary</option><option>Financial Overview</option><option>Event Performance</option><option>Team Productivity</option><option>Vendor Analysis</option>
            </select>
            <button onClick={handleGenerateReport} disabled={reportLoading}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-maroon px-4 text-xs font-bold text-white shadow hover:bg-maroon-dark disabled:opacity-50">
              {reportLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Generate
            </button>
          </div>
          {reportResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 max-h-[300px] overflow-y-auto rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-xs leading-relaxed text-gray-700"
              dangerouslySetInnerHTML={{ __html: fmt(reportResult) }} />
          )}
        </motion.div>
      </div>

      {/* New Inquiry Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="rounded-xl border border-gray-100 bg-white shadow-md"
      >
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">New Inquiry</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Client
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Event
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {inquiriesLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-gold border-t-transparent" />
                  </td>
                </tr>
              ) : inquiriesData?.items?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    No inquiries yet
                  </td>
                </tr>
              ) : (
                inquiriesData?.items?.map((inquiry, i) => {
                  const statusConfig = INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]
                  return (
                    <motion.tr
                      key={inquiry.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      className="border-b border-gray-100 transition-colors hover:bg-gray-50"
                    >
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                        {inquiry.client_name}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {inquiry.event_type}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {inquiry.event_date ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill
                          label={statusConfig?.label ?? inquiry.status}
                          color={statusConfig?.color ?? 'bg-gray-100 text-gray-800'}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => navigate(`/inquiries/${inquiry.id}`)}
                          className="flex items-center gap-1 text-xs font-medium text-maroon hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
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
                    <p className="text-sm font-bold text-gray-900">AI Admin Assistant</p>
                    <p className="text-[10px] text-gray-400">Powered by Gemini · Business Intelligence</p>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="mx-auto max-w-2xl space-y-4">
                  {messages.length === 0 && (
                    <div className="py-12 text-center">
                      <Sparkles size={32} className="mx-auto mb-3 text-maroon/30" />
                      <p className="text-sm font-semibold text-gray-500">Ask me anything about your business</p>
                      <p className="text-xs text-gray-400">Analytics, reports, performance insights, and more</p>
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
                    placeholder="Ask about analytics, reports, team performance..."
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
