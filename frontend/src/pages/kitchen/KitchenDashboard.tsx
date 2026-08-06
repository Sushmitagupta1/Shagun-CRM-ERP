import { motion } from 'framer-motion'
import { useKitchenKPIs } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import { INQUIRY_STATUSES } from '@/lib/constants'
import {
  ChefHat,
  Clock,
  UtensilsCrossed,
  Package,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  Flame,
} from 'lucide-react'

const ingredientsNeeded = [
  { name: 'Paneer', qty: '45 kg', priority: 'High', source: 'Vendor A' },
  { name: 'Basmati Rice', qty: '120 kg', priority: 'High', source: 'Warehouse' },
  { name: 'Chicken', qty: '80 kg', priority: 'Medium', source: 'Vendor B' },
  { name: 'Ghee', qty: '15 L', priority: 'Low', source: 'Warehouse' },
  { name: 'Saffron', qty: '500g', priority: 'Medium', source: 'Vendor A' },
]

const semiFinished = [
  { name: 'Paneer Tikka Masala', for: 'Sharma Wedding', status: 'ready', time: '2 hrs ago' },
  { name: 'Dal Makhani', for: 'Tata Gala', status: 'in-progress', time: 'Cooking' },
  { name: 'Gulab Jamun Syrup', for: 'Mehta Birthday', status: 'ready', time: '3 hrs ago' },
]

export default function KitchenDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.full_name?.split(' ')[0] ?? 'Kitchen'
  const { data: kpis, isLoading } = useKitchenKPIs()
  const { data: inquiriesData } = useInquiries({ per_page: 20 })
  const events = (inquiriesData?.items ?? [])
    .filter((i) => i.event_date)
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))

  return (
    <div className="space-y-5">
      <PageHeader title={`Hi, ${firstName}`} subtitle="Today's production and ingredient management" />

      {/* Top — 3 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: "Today's Events", value: kpis?.todays_production ?? 0, desc: 'Items to produce today', icon: Flame, iconBg: 'bg-red-50', iconColor: 'text-red-500', to: '/inquiries' },
              { label: 'Pending Menus', value: kpis?.pending_kitchen_plans ?? 0, desc: 'Menus not yet planned', icon: ChefHat, iconBg: 'bg-amber-50', iconColor: 'text-amber-500', to: '/inquiries' },
              { label: 'Ingredients Ready', value: semiFinished.filter((s) => s.status === 'ready').length, desc: 'Ready for service', icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', to: '/inquiries' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.08 }}
                onClick={() => navigate(kpi.to)}
                className="cursor-pointer flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-md transition-shadow hover:shadow-lg">
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

      {/* Middle — Production Table (8 cols) + Ingredients (4 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Production Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md lg:col-span-8">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Flame size={14} className="text-red-500" /> Production Schedule
            </h3>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{events.length} events</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Client', 'Event', 'Date', 'Pax', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No production events today</td></tr>
                )}
                {events.map((inq, i) => (
                  <motion.tr key={inq.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-900">{inq.client_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.event_date ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{inq.pax ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusPill label={INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.label ?? inq.status}
                        color={INQUIRY_STATUSES[inq.status as keyof typeof INQUIRY_STATUSES]?.color ?? 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => toast.success('Ingredient request sent to warehouse')}
                          className="rounded p-1 text-gray-400 hover:bg-amber-50 hover:text-amber-600" title="Request Ingredients">
                          <UtensilsCrossed size={14} />
                        </button>
                        <button onClick={() => navigate(`/inquiries/${inq.id}`)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600" title="View Inquiry">
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Ingredients Needed */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-md lg:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
              <Package size={14} className="text-amber-500" /> Ingredients Needed
            </h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {ingredientsNeeded.filter((i) => i.priority === 'High').length} urgent
            </span>
          </div>
          <div className="space-y-2">
            {ingredientsNeeded.map((item, i) => (
              <motion.div key={item.name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.06 }}
                className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  item.priority === 'High' ? 'bg-red-100 text-red-600' : item.priority === 'Medium' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {item.priority === 'High' && <AlertTriangle size={14} />}
                  {item.priority !== 'High' && item.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-900">{item.name}</p>
                  <p className="text-[10px] text-gray-400">{item.qty} · {item.source}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <button onClick={() => toast.info('Opening full ingredient list')}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100">
            View All <ArrowRight size={12} />
          </button>
        </motion.div>
      </div>

      {/* Bottom — Semi-Finished Items (full width) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
        className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
          <CheckCircle2 size={14} className="text-emerald-500" /> Semi-Finished Items
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {semiFinished.map((item, i) => (
            <motion.div key={item.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.06 }}
              className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                item.status === 'ready' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {item.status === 'ready' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-900">{item.name}</p>
                <p className="text-[10px] text-gray-400">{item.for}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                item.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {item.status === 'ready' ? 'Ready' : item.time}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
