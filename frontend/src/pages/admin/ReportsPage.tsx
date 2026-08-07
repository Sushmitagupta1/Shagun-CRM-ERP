import { useState } from 'react'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import { useAdminKPIs, useMonthlyTrend, useFinanceKPIs } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import { useSettlements } from '@/hooks/useSettlements'
import { formatCurrency } from '@/lib/utils'
import { INQUIRY_STATUSES, SETTLEMENT_STATUSES } from '@/lib/constants'
import { Filter, FileSpreadsheet, FileText, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'

const REPORT_TYPES = [
  { id: 'inquiries', label: 'Inquiry Report', description: 'Full inquiry pipeline with status breakdown' },
  { id: 'revenue', label: 'Revenue Report', description: 'Monthly revenue, outstanding, and settlements' },
  { id: 'events', label: 'Event Report', description: 'Upcoming and completed events by department' },
]

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState('inquiries')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  const { data: kpis } = useAdminKPIs()
  const { data: trend } = useMonthlyTrend()
  const { data: finance } = useFinanceKPIs()

  const dateFrom = dateRange.from || undefined
  const dateTo = dateRange.to || undefined

  const { data: inquiriesData } = useInquiries({
    page: 1,
    per_page: 100,
    date_from: selectedReport === 'inquiries' ? dateFrom : undefined,
    date_to: selectedReport === 'inquiries' ? dateTo : undefined,
    event_date_from: selectedReport === 'events' ? dateFrom : undefined,
    event_date_to: selectedReport === 'events' ? dateTo : undefined,
  })

  const { data: settlementsData } = useSettlements({
    per_page: 100,
    date_from: selectedReport === 'revenue' ? dateFrom : undefined,
    date_to: selectedReport === 'revenue' ? dateTo : undefined,
  })

  const inquiryRows = inquiriesData?.items ?? []
  const settlementRows = settlementsData?.items ?? []

  const buildExportHTML = (headers: string[], rows: (string | number)[][]) => {
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#5A0016;color:#fff;font-weight:600}</style>
</head><body><table>
<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
</table></body></html>`
  }

  const handleExportExcel = () => {
    let rows: (string | number)[][] = []
    if (selectedReport === 'revenue') {
      if (!settlementRows.length) { toast.error('No data to export'); return }
      const headers = ['Client Name', 'Revenue', 'Vendor Cost', 'Other Expenses', 'Net Profit', 'Status', 'Created At']
      rows = settlementRows.map((s) => [
        s.client_name ?? '—',
        Number(s.revenue),
        Number(s.vendor_cost),
        Number(s.other_expenses),
        Number(s.net_profit),
        SETTLEMENT_STATUSES[s.status as keyof typeof SETTLEMENT_STATUSES]?.label ?? s.status,
        new Date(s.created_at).toLocaleDateString('en-IN'),
      ])
      downloadHTML(headers, rows)
      return
    }
    if (!inquiryRows.length) { toast.error('No data to export'); return }
    const headers = ['Client Name', 'Phone', 'Event Type', 'Pax', 'Event Date', 'Status', 'Per Plate Rate', 'Add On', 'Assigned To']
    rows = inquiryRows.map((inq) => [
      inq.client_name,
      inq.client_phone ?? '',
      inq.event_type,
      inq.pax ?? '',
      inq.event_date ?? '',
      INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.label ?? inq.status,
      inq.per_plate_rate ?? '',
      inq.add_on ?? '',
      inq.assigned_to ?? '-',
    ])
    downloadHTML(headers, rows)
  }

  const downloadHTML = (headers: string[], rows: (string | number)[][]) => {
    const blob = new Blob([buildExportHTML(headers, rows)], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedReport}-report-${new Date().toISOString().slice(0, 10)}.xls`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Excel report downloaded')
  }

  const handleExportPDF = () => {
    let headers: string[] = []
    let rows: (string | number)[][] = []
    if (selectedReport === 'revenue') {
      if (!settlementRows.length) { toast.error('No data to export'); return }
      headers = ['Client Name', 'Revenue', 'Vendor Cost', 'Other Expenses', 'Net Profit', 'Status', 'Created At']
      rows = settlementRows.map((s) => [
        s.client_name ?? '—',
        `₹${Number(s.revenue).toLocaleString('en-IN')}`,
        `₹${Number(s.vendor_cost).toLocaleString('en-IN')}`,
        `₹${Number(s.other_expenses).toLocaleString('en-IN')}`,
        `₹${Number(s.net_profit).toLocaleString('en-IN')}`,
        SETTLEMENT_STATUSES[s.status as keyof typeof SETTLEMENT_STATUSES]?.label ?? s.status,
        new Date(s.created_at).toLocaleDateString('en-IN'),
      ])
    } else {
      if (!inquiryRows.length) { toast.error('No data to export'); return }
      headers = ['Client Name', 'Phone', 'Event Type', 'Pax', 'Event Date', 'Status', 'Per Plate Rate', 'Add On', 'Assigned To']
      rows = inquiryRows.map((inq) => [
        inq.client_name,
        inq.client_phone ?? '-',
        inq.event_type,
        inq.pax ?? '-',
        inq.event_date ?? '-',
        INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.label ?? inq.status,
        inq.per_plate_rate ? `₹${Number(inq.per_plate_rate).toLocaleString('en-IN')}` : '-',
        inq.add_on ? `₹${Number(inq.add_on).toLocaleString('en-IN')}` : '-',
        inq.assigned_to ?? '-',
      ])
    }
    const win = window.open('', '_blank')
    if (!win) { toast.error('Allow popups to download PDF'); return }
    win.document.write(`<!DOCTYPE html><html><head><title>${selectedReport} Report</title>
<style>
body{font-family:Inter,system-ui,sans-serif;padding:30px;color:#1e293b}
h1{font-size:18px;color:#5A0016;margin:0 0 4px}p{font-size:12px;color:#64748b;margin:0 0 20px}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#5A0016;color:#fff;padding:8px 10px;text-align:left;font-weight:600}
td{padding:7px 10px;border-bottom:1px solid #e2e8f0}
tr:nth-child(even){background:#f8fafc}
@media print{body{padding:15px}button{display:none}}
</style></head><body>
<h1>Shagun Catering — ${REPORT_TYPES.find((r) => r.id === selectedReport)?.label}</h1>
<p>Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}${dateFrom || dateTo ? ` · ${dateFrom || '…'} to ${dateTo || '…'}` : ''}</p>
<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload=function(){window.print();window.close()}<\/script>
</body></html>`)
    win.document.close()
    toast.success('PDF download initiated')
  }

  const totalInquiries = kpis?.total_inquiries ?? 0
  const confirmed = kpis?.confirmed ?? 0
  const convRate = totalInquiries > 0 ? ((confirmed / totalInquiries) * 100).toFixed(1) : '0'

  const summaryCards =
    selectedReport === 'revenue'
      ? [
          { label: 'Pending Settlements', value: finance?.pending_settlements ?? 0, color: 'text-amber-600' },
          { label: 'Completed Settlements', value: finance?.completed_settlements ?? 0, color: 'text-emerald-600' },
          { label: 'Total Revenue', value: formatCurrency(finance?.total_revenue ?? 0), color: 'text-gold' },
          { label: 'Total Profit', value: formatCurrency(finance?.total_profit ?? 0), color: 'text-maroon' },
        ]
      : selectedReport === 'events'
        ? [
            { label: 'Events in Range', value: inquiryRows.filter((i) => i.event_date).length, color: 'text-blue-600' },
            { label: 'Upcoming', value: inquiryRows.filter((i) => i.event_date && new Date(i.event_date) >= new Date()).length, color: 'text-emerald-600' },
            { label: 'Past', value: inquiryRows.filter((i) => i.event_date && new Date(i.event_date) < new Date()).length, color: 'text-rose-600' },
            { label: 'Total Inquiries', value: totalInquiries, color: 'text-gold' },
          ]
        : [
            { label: 'Total Inquiries', value: totalInquiries, color: 'text-blue-600' },
            { label: 'Conversion Rate', value: `${convRate}%`, color: 'text-emerald-600' },
            { label: 'Total Revenue', value: formatCurrency(kpis?.total_revenue ?? 0), color: 'text-gold' },
            { label: 'Outstanding', value: formatCurrency(kpis?.outstanding_amount ?? 0), color: 'text-rose-600' },
          ]

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" subtitle="Generate, view, and export business reports" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Report Type Selector */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Report Type</h3>
          {REPORT_TYPES.map((report) => (
            <motion.button
              key={report.id}
              whileHover={{ x: 4 }}
              onClick={() => setSelectedReport(report.id)}
              className={`w-full rounded-xl p-3 text-left text-sm transition-all ${
                selectedReport === report.id
                  ? 'bg-maroon text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <p className="font-medium">{report.label}</p>
              <p className={`mt-0.5 text-xs ${selectedReport === report.id ? 'text-white/70' : 'text-slate-400'}`}>
                {report.description}
              </p>
            </motion.button>
          ))}
        </div>

        {/* Report Preview */}
        <div className="lg:col-span-3 space-y-4">
          {/* Date Filter */}
          <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-md">
            <Filter size={16} className="text-slate-400" />
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">From</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">To</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-emerald-700"
              >
                <FileSpreadsheet size={14} />
                Download Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-rose-700"
              >
                <FileText size={14} />
                Download PDF
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {summaryCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl bg-white p-4 shadow-md"
              >
                <p className="text-xs font-medium text-slate-400">{card.label}</p>
                <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
              </motion.div>
            ))}
          </div>

          {selectedReport === 'revenue' ? (
            /* Revenue Report: Settlements Table */
            <div className="rounded-xl bg-white p-5 shadow-md">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Settlements</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      {['Client Name', 'Revenue', 'Vendor Cost', 'Other Expenses', 'Net Profit', 'Status', 'Created'].map((h) => (
                        <th key={h} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {settlementRows.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No settlements in this range</td></tr>
                    ) : settlementRows.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100">
                        <td className="px-3 py-2.5 text-sm font-medium text-slate-800">{s.client_name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-600">{formatCurrency(Number(s.revenue))}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-600">{formatCurrency(Number(s.vendor_cost))}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-600">{formatCurrency(Number(s.other_expenses))}</td>
                        <td className="px-3 py-2.5 text-sm font-semibold text-slate-800">{formatCurrency(Number(s.net_profit))}</td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            s.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {SETTLEMENT_STATUSES[s.status as keyof typeof SETTLEMENT_STATUSES]?.label ?? s.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-500">{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : selectedReport === 'events' ? (
            /* Event Report: Upcoming/Completed Events */
            <div className="rounded-xl bg-white p-5 shadow-md">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays size={16} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-700">Events</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      {['Client Name', 'Event Type', 'Event Date', 'Pax', 'Status'].map((h) => (
                        <th key={h} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inquiryRows.filter((i) => i.event_date).length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No events in this range</td></tr>
                    ) : inquiryRows.filter((i) => i.event_date).sort((a, b) => (a.event_date! < b.event_date! ? -1 : 1)).map((inq) => (
                      <tr key={inq.id} className="border-b border-slate-100">
                        <td className="px-3 py-2.5 text-sm font-medium text-slate-800">{inq.client_name}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-600">{inq.event_type}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-600">{inq.event_date}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-600">{inq.pax ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            inq.event_date && new Date(inq.event_date) < new Date() ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {inq.event_date && new Date(inq.event_date) < new Date() ? 'Completed' : 'Upcoming'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Inquiry Report: Status Breakdown + Trend */
            <>
              {/* Status Breakdown */}
              <div className="rounded-xl bg-white p-5 shadow-md">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Status Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(INQUIRY_STATUSES).map(([key, value]) => {
                    const statusLabel = typeof value === 'string' ? value : (value as { label: string }).label
                    const count = inquiryRows.filter((inq) => inq.status === key).length
                    const total = inquiryRows.length || 1
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="w-32 text-xs font-medium text-slate-600">{statusLabel}</span>
                        <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="h-2 rounded-full bg-maroon"
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold text-slate-700">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Monthly Trend */}
              {trend && trend.length > 0 && (
                <div className="rounded-xl bg-white p-5 shadow-md">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Monthly Inquiry Trend</h3>
                  <div className="flex items-end gap-2">
                    {trend.slice(-6).map((m, i) => {
                      const max = Math.max(...trend.slice(-6).map((t) => t.count))
                      const h = max > 0 ? (m.count / max) * 100 : 0
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold text-slate-600">{m.count}</span>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ duration: 0.5, delay: i * 0.05 }}
                            className="w-full rounded-t-md bg-maroon"
                            style={{ minHeight: 4 }}
                          />
                          <span className="text-[10px] text-slate-400">{m.month}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
