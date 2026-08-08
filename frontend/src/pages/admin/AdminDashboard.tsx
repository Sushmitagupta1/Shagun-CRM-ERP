import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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
import { generateReport } from '@/lib/groq'
import { Loader2, FileText, Send, Eye } from 'lucide-react'

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
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="bg-gray-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Client
                </th>
                <th className="bg-gray-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Event
                </th>
                <th className="bg-gray-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th className="bg-gray-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="bg-gray-50 px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
    </div>
  )
}
