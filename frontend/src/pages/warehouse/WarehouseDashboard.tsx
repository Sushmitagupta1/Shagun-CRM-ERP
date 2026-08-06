import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWarehouseKPIs } from '@/hooks/useDashboard'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import {
  Package,
  AlertTriangle,
  ArrowUpFromLine,
  ArrowDownToLine,
  Eye,
  ArrowRight,
  Truck,
} from 'lucide-react'

const pendingDispatches = [
  { id: '1', event: 'Sharma Wedding', client: 'Priya & Rahul', date: '2024-12-20', items: 8, status: 'pending', priority: 'High' },
  { id: '2', event: 'Tata Annual Gala', client: 'Tata Motors', date: '2024-12-22', items: 12, status: 'pending', priority: 'High' },
  { id: '3', event: 'Mehta Birthday', client: 'Mehta Family', date: '2024-12-21', items: 4, status: 'dispatched', priority: 'Medium' },
]

const lowStockItems = [
  { name: 'Table Linens (White)', current: 8, min: 20, unit: 'pieces' },
  { name: 'Stage Lighting Kit', current: 0, min: 3, unit: 'kits' },
  { name: 'Chafing Dishes (Large)', current: 3, min: 10, unit: 'pieces' },
]

const recentActivity = [
  { id: '1', action: 'Dispatched', item: '12x Chafing Dishes', event: 'Tata Gala', time: '2 hrs ago', icon: ArrowUpFromLine, color: 'text-blue-500' },
  { id: '2', action: 'Received', item: '50x Table Linens', event: 'Stock Restock', time: '4 hrs ago', icon: ArrowDownToLine, color: 'text-emerald-500' },
  { id: '3', action: 'Returned', item: '8x Serving Trays', event: 'Sharma Wedding', time: 'Yesterday', icon: Package, color: 'text-amber-500' },
]

export default function WarehouseDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.full_name?.split(' ')[0] ?? 'THOL'
  const [activeTab, setActiveTab] = useState<'pending' | 'dispatched'>('pending')
  const { data: kpis, isLoading } = useWarehouseKPIs()

  const filteredDispatches = pendingDispatches.filter((d) =>
    activeTab === 'pending' ? d.status === 'pending' : d.status === 'dispatched'
  )

  return (
    <div className="space-y-5">
      <PageHeader title={`Hi, ${firstName}`} subtitle="Manage inventory dispatch and stock levels" />

      {/* Top — 3 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: 'Pending Dispatches', value: kpis?.pending_requests ?? 0, desc: 'Events awaiting material', icon: Truck, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', to: '/inquiries' },
              { label: 'Items in Stock', value: kpis?.todays_issues ?? 0, desc: 'Items dispatched today', icon: ArrowUpFromLine, iconBg: 'bg-amber-50', iconColor: 'text-amber-500', to: '/inquiries' },
              { label: 'Low Stock Alerts', value: lowStockItems.length, desc: 'Need restocking', icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-500', to: '/inquiries' },
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

      {/* Middle — Dispatch Table (8 cols) + Low Stock Alert (4 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Dispatch Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md lg:col-span-8">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(['pending', 'dispatched'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 text-xs font-semibold capitalize transition-colors ${
                  activeTab === tab ? 'border-b-2 border-gold text-gold' : 'text-gray-400 hover:text-gray-600'
                }`}>
                {tab === 'pending' ? 'Pending Dispatch' : 'Dispatched'}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Event', 'Client', 'Date', 'Items', 'Priority', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDispatches.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                    {activeTab === 'pending' ? 'All dispatches completed!' : 'No dispatches yet today'}
                  </td></tr>
                )}
                {filteredDispatches.map((d, i) => (
                  <motion.tr key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-900">{d.event}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{d.client}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{d.date}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{d.items} items</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        d.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>{d.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {d.status === 'pending' && (
                          <button onClick={() => toast.success(`${d.event} dispatched!`)}
                            className="rounded p-1 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title="Dispatch">
                            <ArrowUpFromLine size={14} />
                          </button>
                        )}
                        <button onClick={() => navigate(`/inquiries/${d.id}`)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600" title="View">
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

        {/* Low Stock Alert */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-xl border border-red-200 bg-red-50/50 p-5 shadow-md lg:col-span-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h3 className="text-sm font-bold text-red-900">Low Stock Alert</h3>
          </div>
          <div className="space-y-3">
            {lowStockItems.map((item, i) => {
              const pct = item.min > 0 ? Math.round((item.current / item.min) * 100) : 0
              return (
                <motion.div key={item.name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.06 }}
                  className="rounded-lg border border-red-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-900">{item.name}</p>
                    <span className="text-[10px] font-bold text-red-600">{item.current}/{item.min}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-red-100">
                    <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">{item.current} {item.unit} · Min {item.min}</p>
                </motion.div>
              )
            })}
          </div>
          <button onClick={() => toast.info('Opening restock order')}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 bg-white py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
            Restock Now <ArrowRight size={12} />
          </button>
        </motion.div>
      </div>

      {/* Bottom — Recent Activity (full width) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
        className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Recent Activity</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {recentActivity.map((act, i) => (
            <motion.div key={act.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.06 }}
              className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                <act.icon size={18} className={act.color} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-900">{act.item}</p>
                <p className="text-[10px] text-gray-400">{act.action} · {act.event}</p>
              </div>
              <span className="text-[10px] text-gray-300">{act.time}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
