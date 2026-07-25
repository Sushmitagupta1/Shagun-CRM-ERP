import { motion } from 'framer-motion'
import { useOperationsKPIs } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import { INQUIRY_STATUSES } from '@/lib/constants'
import {
  Calendar,
  ChefHat,
  Truck,
  Package,
  CheckCircle2,
  ArrowRightLeft,
  Image,
  Plus,
  Clock,
  DollarSign,
  Building2,
  MoreVertical,
} from 'lucide-react'

const eventTimeline = [
  { stage: 'Planning', days: '7 days before', icon: Calendar, color: '#3B82F6', completed: true },
  { stage: 'Kitchen', days: '7 days before', icon: ChefHat, color: '#F59E0B', completed: true },
  { stage: 'Warehouse', days: '7 days before', icon: Package, color: '#8B5CF6', completed: false },
  { stage: 'Execution', days: '1 day before', icon: Truck, color: '#EF4444', completed: false },
  { stage: 'Completion', days: 'Same day', icon: CheckCircle2, color: '#10B981', completed: false },
  { stage: 'Settlement', days: 'Same day', icon: DollarSign, color: '#6B7280', completed: false },
]

const todayEvents = [
  { id: '1', name: 'Sharma Wedding Reception', time: '6:00 PM', venue: 'Grand Palace Banquet' },
  { id: '2', name: 'Tata Motors Annual Gala', time: '7:30 PM', venue: 'ITC Maurya' },
  { id: '3', name: 'Mehta Family Birthday', time: '12:00 PM', venue: 'Hyatt Regency' },
]

const vendorFinancials = [
  { label: 'Pending Payments', value: '₹2,45,000', color: 'text-amber-600' },
  { label: 'Paid This Month', value: '₹5,80,000', color: 'text-emerald-600' },
  { label: 'Upcoming Dues', value: '₹1,20,000', color: 'text-rose-600' },
]

export default function OperationsDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.full_name?.split(' ')[0] ?? 'Operations'
  const { data: kpis, isLoading } = useOperationsKPIs()
  const { data: inquiriesData } = useInquiries({ status: 'confirmed', per_page: 10 })
  const confirmedEvents = inquiriesData?.items ?? []

  const quickActions = [
    { label: 'Create Vendor', icon: Plus, action: () => toast.success('Vendor form opened') },
    { label: 'Warehouse', icon: Package, action: () => navigate('/warehouse') },
    { label: 'Upload Photos', icon: Image, action: () => toast.info('Select an event to upload photos') },
    { label: 'Transfer', icon: ArrowRightLeft, action: () => toast.info('Transfer panel opened') },
    { label: 'Complete', icon: CheckCircle2, action: () => toast.info('Select an event to complete') },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={`Hi, ${firstName}`} subtitle="Manage event execution, vendors, and logistics" />

      {/* Top Row — 5 KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: 'Upcoming Events', value: kpis?.upcoming_events ?? 0, color: 'text-blue-600' },
              { label: "Today's Events", value: kpis?.todays_events ?? 0, color: 'text-amber-600' },
              { label: 'Kitchen Pending', value: kpis?.pending_kitchen_plans ?? 0, color: 'text-rose-600' },
              { label: 'Vendor Requests', value: kpis?.pending_vendor_requests ?? 0, color: 'text-purple-600' },
              { label: 'Warehouse Req.', value: kpis?.pending_warehouse_requests ?? 0, color: 'text-emerald-600' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-md transition-shadow hover:shadow-lg"
                style={{ height: 95 }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{kpi.label}</p>
                <p className={`mt-2 text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              </motion.div>
            ))}
      </div>

      {/* Middle Row — 3 Columns: Event Pipeline | Today's Schedule | Vendor Financials */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Event Pipeline Step-Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md"
          style={{ minHeight: 320 }}
        >
          <h3 className="mb-4 text-sm font-bold text-gray-900">Event Pipeline</h3>
          <div className="relative flex flex-col gap-0">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-200" />
            {eventTimeline.map((step, i) => (
              <motion.div
                key={step.stage}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="relative flex items-center gap-3 py-2.5"
              >
                <div
                  className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    step.completed ? 'bg-emerald-500' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {step.completed ? <CheckCircle2 size={12} /> : i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900">{step.stage}</p>
                  <p className="text-[10px] text-gray-400">{step.days}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Today's Events Schedule */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md"
          style={{ minHeight: 320 }}
        >
          <h3 className="mb-4 text-sm font-bold text-gray-900">Today's Schedule</h3>
          <div className="space-y-3">
            {todayEvents.map((evt, i) => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className="rounded-lg border border-gray-100 bg-white p-3.5"
                style={{ borderLeft: '4px solid #D97706' }}
              >
                <p className="text-sm font-bold text-gray-900">{evt.name}</p>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1"><Clock size={10} /> {evt.time}</span>
                  <span className="flex items-center gap-1"><Building2 size={10} /> {evt.venue}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Vendor Financial Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="rounded-xl border border-gray-100 bg-white p-6 shadow-md"
          style={{ minHeight: 320 }}
        >
          <h3 className="mb-5 text-sm font-bold text-gray-900">Vendor Financial Summary</h3>
          <div className="space-y-4">
            {vendorFinancials.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.08 }}
                className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0"
              >
                <span className="text-sm text-gray-500">{item.label}</span>
                <span className={`text-lg font-bold tabular-nums ${item.color}`}>{item.value}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row — Quick Actions (5 cols) + Events Table (7 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Quick Action Control Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md lg:col-span-5"
          style={{ minHeight: 260 }}
        >
          <h3 className="mb-4 text-sm font-bold text-gray-900">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action, i) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.06 }}
                whileHover={{ y: -2 }}
                onClick={action.action}
                className="flex flex-col items-center gap-2 rounded-[10px] border border-gray-200 bg-gray-50 p-3.5 text-center transition-colors hover:bg-gray-100"
              >
                <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[10px] border border-gray-200 bg-white">
                  <action.icon size={22} className="text-gold" />
                </div>
                <span className="text-[11px] font-semibold text-gray-700">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Recent Events Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md lg:col-span-7"
          style={{ minHeight: 260 }}
        >
          <div className="border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-bold text-gray-900">Confirmed Events</h3>
          </div>
          <div className="overflow-y-auto" style={{ height: 226 }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Client', 'Event', 'Date', 'Pax', 'Status', ''].map((h) => (
                    <th key={h + Math.random()} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confirmedEvents.slice(0, 5).map((inq) => (
                  <tr key={inq.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
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
                      <button className="rounded p-1 text-gray-400 hover:bg-gray-100">
                        <MoreVertical size={14} />
                      </button>
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
