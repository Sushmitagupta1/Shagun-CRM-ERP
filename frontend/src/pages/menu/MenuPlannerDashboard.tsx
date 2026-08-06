import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useMenuPlannerKPIs } from '@/hooks/useDashboard'
import { useInquiries } from '@/hooks/useInquiries'
import { getMenuTemplates } from '@/api/menu'
import { useAuth } from '@/hooks/useAuth'
import { createInquiry, updateInquiry } from '@/api/inquiries'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { KPICardSkeleton } from '@/components/common/Skeleton'
import { InquiryForm } from '@/pages/inquiries/InquiryForm'
import { INQUIRY_STATUSES } from '@/lib/constants'
import {
  Sparkles,
  Clock,
  FileText,
  Utensils,
  X,
} from 'lucide-react'

export default function MenuPlannerDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const firstName = user?.full_name?.split(' ')[0] ?? 'Menu Planner'
  const { data: kpis, isLoading } = useMenuPlannerKPIs()
  const { data: inquiriesData } = useInquiries({ per_page: 10 })
  const assignedInquiries = inquiriesData?.items?.filter(
    (i) => i.status !== 'advance_receive' && i.status !== 'operation_handover'
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateInquiry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      toast.success('Inquiry updated')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Update failed'
      toast.error(message)
    },
  })

  const { data: templatesData } = useQuery({
    queryKey: ['menu-templates'],
    queryFn: getMenuTemplates,
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader title={`Hi, ${firstName}`} subtitle="Create menus, estimate costs, and manage AI-powered suggestions" />
      </div>

      {/* Top — 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
          : [
              { label: 'New Inquiry', value: kpis?.assigned_inquiries ?? 0, desc: 'Menus to prepare', icon: FileText, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', to: '/inquiries' },
              { label: 'Pending Menus', value: kpis?.pending_menus ?? 0, desc: 'Awaiting finalization', icon: Clock, iconBg: 'bg-amber-50', iconColor: 'text-amber-500', to: '/inquiries' },
              { label: 'AI Generated', value: kpis?.ai_menus_generated ?? 0, desc: 'Menus via AI', icon: Sparkles, iconBg: 'bg-purple-50', iconColor: 'text-purple-500', to: '/inquiries' },
              { label: 'Templates', value: templatesData?.length ?? 0, desc: 'Ready to use', icon: Utensils, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', to: '/menu-library' },
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
                onStage1Submit={async (data) => {
                  const created = await createMutation.mutateAsync(data)
                  return created.id
                }}
                onStage2Submit={async (id, data) => {
                  await updateMutation.mutateAsync({ id, data })
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Row — Menus to Prepare */}
      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
          className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md lg:col-span-3">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-bold text-gray-900">Menus to Prepare</h3>
            <span className="text-[10px] text-gray-400">{assignedInquiries.length} pending</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Client', 'Event', 'Date', 'Pax', 'Status', 'Generate'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignedInquiries.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No pending menus</td></tr>}
                {assignedInquiries
                  .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
                  .slice(0, 10).map((inq, i) => (
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
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/menu-generator/${inq.id}`)}
                        className="flex items-center gap-1 rounded bg-maroon/10 px-2.5 py-1 text-[10px] font-medium text-maroon transition-colors hover:bg-maroon hover:text-white">
                        <Sparkles size={11} /> Generate
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

    </div>
  )
}
