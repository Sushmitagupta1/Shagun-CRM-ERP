import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInquiry, updateInquiryStatus } from '@/api/inquiries'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { INQUIRY_STATUSES, PAYMENT_STATUSES } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Upload,
  FileText,
  Eye,
  Plus,
  Trash2,
  ChefHat,
  Presentation,
  Truck,
  Package,
  BarChart3,
  ArrowRightLeft,
  RotateCcw,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react'

const NEXT_STATUS: Record<string, string[]> = {
  new: ['follow_up', 'cancelled'],
  follow_up: ['menu_ready', 'presentation_sent', 'negotiation', 'cancelled'],
  menu_ready: ['presentation_sent', 'negotiation', 'cancelled'],
  presentation_sent: ['menu_ready', 'negotiation', 'cancelled'],
  negotiation: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

const PROGRESS_STEPS = [
  { key: 'new', label: 'New' },
  { key: 'follow_up', label: 'Follow Up' },
  { key: 'menu_ready', label: 'Menu + Presentation' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
]

const PROGRESS_ORDER = ['new', 'follow_up', 'menu_ready', 'presentation_sent', 'negotiation', 'confirmed', 'completed']

interface IngredientRow {
  item: string
  qty: string
  unit: string
  priority: string
}

interface DispatchRow {
  item: string
  qty: string
  status: string
}

interface ReturnRow {
  item: string
  qtySent: string
  qtyReturned: string
  reason: string
}

interface MovementRow {
  item: string
  qty: string
  notes: string
}

export default function InquiryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const role = user?.role.name ?? ''
  const isAdmin = role === 'admin'
  const isKitchen = role === 'kitchen'
  const isOps = role === 'operations_manager'
  const isWarehouse = role === 'warehouse'

  const { data: inquiry, isLoading } = useQuery({
    queryKey: ['inquiry', id],
    queryFn: () => getInquiry(id!),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateInquiryStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiry', id] })
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      toast.success('Status updated')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to update status'
      toast.error(message)
    },
  })

  // File states
  const [menuFile, setMenuFile] = useState<string | null>(null)
  const [presentationFile, setPresentationFile] = useState<string | null>(null)
  const [ingredientFile, setIngredientFile] = useState<string | null>(null)
  const [showMenuUpload, setShowMenuUpload] = useState(false)
  const [showPresentationUpload, setShowPresentationUpload] = useState(false)
  const [showIngredientUpload, setShowIngredientUpload] = useState(false)

  // Kitchen ingredient list
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [newIngredient, setNewIngredient] = useState<IngredientRow>({ item: '', qty: '', unit: 'kg', priority: 'Medium' })

  // Warehouse dispatch
  const [dispatchItems, setDispatchItems] = useState<DispatchRow[]>([])
  const [newDispatch, setNewDispatch] = useState<DispatchRow>({ item: '', qty: '', status: 'Pending' })

  // Warehouse return form
  const [returnItems, setReturnItems] = useState<ReturnRow[]>([])
  const [newReturn, setNewReturn] = useState<ReturnRow>({ item: '', qtySent: '', qtyReturned: '', reason: '' })

  // Lalit return/transfer/wastage
  const [movementType, setMovementType] = useState<'return' | 'transfer' | 'wastage'>('return')
  const [movementItems, setMovementItems] = useState<MovementRow[]>([])
  const [newMovement, setNewMovement] = useState<MovementRow>({ item: '', qty: '', notes: '' })

  // Modals
  const [viewMenu, setViewMenu] = useState(false)
  const [viewPresentation, setViewPresentation] = useState(false)
  const [viewIngredients, setViewIngredients] = useState(false)
  const [viewDispatch, setViewDispatch] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-maroon border-t-transparent" />
      </div>
    )
  }

  if (!inquiry) {
    return <div className="py-20 text-center text-gray-500">Inquiry not found</div>
  }

  const nextStatuses = NEXT_STATUS[inquiry.status] || []
  const isPostConfirm = ['confirmed', 'completed'].includes(inquiry.status)

  const progressIndex = PROGRESS_ORDER.indexOf(inquiry.status)
  const currentStep = PROGRESS_STEPS.findIndex((s) => {
    if (s.key === 'menu_ready') return ['menu_ready', 'presentation_sent', 'negotiation'].includes(inquiry.status)
    return PROGRESS_ORDER.indexOf(s.key) <= progressIndex
  })

  const handleFileUpload = (type: 'menu' | 'presentation' | 'ingredient') => {
    const name = `${type === 'ingredient' ? 'Ingredient List' : type === 'menu' ? 'Menu' : 'Presentation'}_${inquiry.client_name.replace(/\s+/g, '_')}.xlsx`
    if (type === 'menu') setMenuFile(name)
    else if (type === 'presentation') setPresentationFile(name)
    else setIngredientFile(name)
    toast.success(`${type === 'ingredient' ? 'Ingredient list' : type.charAt(0).toUpperCase() + type.slice(1)} uploaded`)
    setShowMenuUpload(false)
    setShowPresentationUpload(false)
    setShowIngredientUpload(false)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isPostConfirm ? `Event — ${inquiry.client_name}` : `Inquiry — ${inquiry.client_name}`}
        subtitle={isPostConfirm ? 'Event in execution' : undefined}
        action={
          <button onClick={() => navigate('/inquiries')}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        }
      />

      {/* Progress Bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-gray-100 bg-white p-4 shadow-md">
        <div className="flex items-center justify-between">
          {PROGRESS_STEPS.map((step, i) => {
            const isReached = i <= currentStep
            const isActive = step.key === 'menu_ready'
              ? ['menu_ready', 'presentation_sent'].includes(inquiry.status)
              : inquiry.status === step.key
            return (
              <div key={step.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isActive ? 'bg-maroon text-white shadow-md shadow-maroon/30' :
                    isReached ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isReached && !isActive ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <p className={`mt-1.5 text-[10px] font-semibold ${isActive ? 'text-maroon' : isReached ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                </div>
                {i < PROGRESS_STEPS.length - 1 && (
                  <div className={`mx-1 mt-[-16px] h-0.5 flex-1 rounded ${isReached && i < currentStep ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Event Details + Status */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold text-gray-900">Event Details</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Client Name', value: inquiry.client_name },
              { label: 'Phone', value: inquiry.client_phone },
              { label: 'Event Type', value: inquiry.event_type },
              { label: 'Event Date', value: formatDate(inquiry.event_date) },
              { label: 'Pax', value: inquiry.pax ?? '—' },
              { label: 'Budget', value: inquiry.budget ? formatCurrency(Number(inquiry.budget)) : '—' },
              { label: 'Follow-up Date', value: formatDate(inquiry.follow_up_date) },
              { label: 'Created', value: formatDate(inquiry.created_at) },
            ].map((f) => (
              <div key={f.label}>
                <p className="text-xs text-gray-500">{f.label}</p>
                <p className="text-sm font-medium text-gray-900">{f.value}</p>
              </div>
            ))}
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Remarks</p>
              <p className="text-sm font-medium text-gray-900">{inquiry.remarks ?? '—'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
          <h3 className="mb-4 text-sm font-bold text-gray-900">Status</h3>
          <div className="mb-4">
            <StatusPill label={INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.label ?? inquiry.status}
              color={INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.color ?? 'bg-gray-100 text-gray-800'} />
          </div>
          <div className="mb-4">
            <p className="mb-1 text-xs text-gray-500">Payment</p>
            <StatusPill label={PAYMENT_STATUSES[inquiry.payment_status as keyof typeof PAYMENT_STATUSES]?.label ?? inquiry.payment_status}
              color={PAYMENT_STATUSES[inquiry.payment_status as keyof typeof PAYMENT_STATUSES]?.color ?? 'bg-gray-100 text-gray-800'} />
          </div>
          {Number(inquiry.advance_amount) > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500">Advance Paid</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(inquiry.advance_amount))}</p>
            </div>
          )}
          {nextStatuses.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium text-gray-500">Update Status</p>
              {nextStatuses.map((status) => (
                <button key={status} onClick={() => statusMutation.mutate(status)} disabled={statusMutation.isPending}
                  className={`flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ${
                    status === 'confirmed' ? 'bg-emerald-500 text-white hover:bg-emerald-600' :
                    status === 'completed' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                    status === 'cancelled' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' :
                    'bg-maroon text-white hover:bg-maroon-dark'
                  } disabled:opacity-50`}>
                  {statusMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  {INQUIRY_STATUSES[status as keyof typeof INQUIRY_STATUSES]?.label ?? status}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* === MENU SECTION === */}
      {(isAdmin || isKitchen || isOps || isWarehouse) && (
        <WorkflowSection icon={ChefHat} iconColor="text-purple-500" title="Menu"
          visibleRoles={['menu_planner', 'kitchen', 'operations_manager', 'warehouse', 'admin']}
          role={role}>
          <div className="flex items-center justify-between">
            <div>
              {menuFile ? (
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-emerald-500" />
                  <span className="text-sm font-medium text-gray-900">{menuFile}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Uploaded</span>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No menu uploaded yet</p>
              )}
            </div>
            <div className="flex gap-2">
              {menuFile && (
                <button onClick={() => setViewMenu(true)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
                  <Eye size={14} /> View
                </button>
              )}
              {(isAdmin) && (
                <button onClick={() => setShowMenuUpload(!showMenuUpload)}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-maroon px-3 text-xs font-bold text-white hover:bg-maroon-dark">
                  <Upload size={14} /> Upload Menu
                </button>
              )}
            </div>
          </div>
          <AnimatePresence>
            {showMenuUpload && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-2 text-xs font-medium text-gray-600">Upload menu file (Excel/PDF)</p>
                <button onClick={() => handleFileUpload('menu')}
                  className="flex h-9 items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 text-xs font-medium text-gray-600 hover:border-maroon hover:text-maroon">
                  <Upload size={14} /> Choose file
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </WorkflowSection>
      )}

      {/* === PRESENTATION SECTION === */}
      {(isAdmin || isKitchen || isOps || isWarehouse) && (
        <WorkflowSection icon={Presentation} iconColor="text-indigo-500" title="Presentation"
          visibleRoles={['presentation_exec', 'kitchen', 'operations_manager', 'warehouse', 'admin']}
          role={role}>
          <div className="flex items-center justify-between">
            <div>
              {presentationFile ? (
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-emerald-500" />
                  <span className="text-sm font-medium text-gray-900">{presentationFile}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Uploaded</span>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No presentation uploaded yet</p>
              )}
            </div>
            <div className="flex gap-2">
              {presentationFile && (
                <button onClick={() => setViewPresentation(true)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
                  <Eye size={14} /> View
                </button>
              )}
              {(isAdmin) && (
                <button onClick={() => setShowPresentationUpload(!showPresentationUpload)}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-maroon px-3 text-xs font-bold text-white hover:bg-maroon-dark">
                  <Upload size={14} /> Upload Presentation
                </button>
              )}
            </div>
          </div>
          <AnimatePresence>
            {showPresentationUpload && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-2 text-xs font-medium text-gray-600">Upload presentation/theme file</p>
                <button onClick={() => handleFileUpload('presentation')}
                  className="flex h-9 items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 text-xs font-medium text-gray-600 hover:border-maroon hover:text-maroon">
                  <Upload size={14} /> Choose file
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </WorkflowSection>
      )}

      {/* === KITCHEN SECTION (post-confirm only) === */}
      {isPostConfirm && isKitchen && (
        <WorkflowSection icon={ChefHat} iconColor="text-amber-500" title="Kitchen — Ingredient List"
          visibleRoles={['kitchen']} role={role}>
          <div className="flex items-center justify-between mb-3">
            <div>
              {ingredientFile ? (
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-emerald-500" />
                  <span className="text-sm font-medium text-gray-900">{ingredientFile}</span>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Upload ingredient list for warehouse</p>
              )}
            </div>
            <div className="flex gap-2">
              {ingredients.length > 0 && (
                <button onClick={() => setViewIngredients(true)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
                  <Eye size={14} /> View List
                </button>
              )}
              <button onClick={() => setShowIngredientUpload(!showIngredientUpload)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600">
                <Upload size={14} /> {ingredientFile ? 'Re-upload' : 'Upload Ingredient List'}
              </button>
            </div>
          </div>

          {/* Ingredient table */}
          {ingredients.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {['Item', 'Quantity', 'Unit', 'Priority', ''].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-3 py-2 text-xs font-medium text-gray-900">{ing.item}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{ing.qty}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{ing.unit}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ing.priority === 'High' ? 'bg-red-100 text-red-700' :
                          ing.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        }`}>{ing.priority}</span>
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add ingredient row */}
          {showIngredientUpload && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="grid grid-cols-4 gap-2">
                <input placeholder="Item name" value={newIngredient.item} onChange={(e) => setNewIngredient({ ...newIngredient, item: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
                <input placeholder="Qty" value={newIngredient.qty} onChange={(e) => setNewIngredient({ ...newIngredient, qty: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
                <select value={newIngredient.unit} onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs">
                  <option>kg</option><option>L</option><option>pcs</option><option>g</option><option>packs</option>
                </select>
                <select value={newIngredient.priority} onChange={(e) => setNewIngredient({ ...newIngredient, priority: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs">
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => {
                  if (newIngredient.item && newIngredient.qty) {
                    setIngredients([...ingredients, newIngredient])
                    setNewIngredient({ item: '', qty: '', unit: 'kg', priority: 'Medium' })
                    toast.success('Ingredient added')
                  }
                }} className="flex h-8 items-center gap-1 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-white hover:bg-emerald-600">
                  <Plus size={12} /> Add Row
                </button>
                <button onClick={() => handleFileUpload('ingredient')}
                  className="flex h-8 items-center gap-1 rounded-lg bg-maroon px-3 text-xs font-bold text-white hover:bg-maroon-dark">
                  <Upload size={12} /> Upload Excel
                </button>
              </div>
            </div>
          )}
        </WorkflowSection>
      )}

      {/* === OPERATIONS / LALIT SECTION (post-confirm only) === */}
      {isPostConfirm && isOps && (
        <WorkflowSection icon={Truck} iconColor="text-blue-500" title="Operations — Coordination"
          visibleRoles={['operations_manager']} role={role}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* View menu + ingredients */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Received from Teams</p>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChefHat size={14} className="text-purple-500" />
                    <span className="text-xs font-semibold text-gray-900">Menu</span>
                    {menuFile ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Ready</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
                    )}
                  </div>
                  {menuFile && <button onClick={() => setViewMenu(true)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><Eye size={14} /></button>}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-amber-500" />
                    <span className="text-xs font-semibold text-gray-900">Ingredient List</span>
                    {ingredients.length > 0 || ingredientFile ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Ready</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
                    )}
                  </div>
                  {(ingredients.length > 0 || ingredientFile) && (
                    <button onClick={() => setViewIngredients(true)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><Eye size={14} /></button>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-blue-500" />
                    <span className="text-xs font-semibold text-gray-900">Warehouse Dispatch</span>
                    {dispatchItems.length > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{dispatchItems.filter((d) => d.status === 'Dispatched').length}/{dispatchItems.length} Sent</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
                    )}
                  </div>
                  {dispatchItems.length > 0 && (
                    <button onClick={() => setViewDispatch(true)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><Eye size={14} /></button>
                  )}
                </div>
              </div>
            </div>

            {/* Return / Transfer / Wastage form */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Add Movement</p>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="mb-3 flex gap-2">
                  {(['return', 'transfer', 'wastage'] as const).map((t) => (
                    <button key={t} onClick={() => setMovementType(t)}
                      className={`flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold capitalize transition-colors ${
                        movementType === t ? 'bg-maroon text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {t === 'return' && <RotateCcw size={12} />}
                      {t === 'transfer' && <ArrowRightLeft size={12} />}
                      {t === 'wastage' && <AlertTriangle size={12} />}
                      {t}
                    </button>
                  ))}
                </div>
                {movementItems.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {movementItems.map((m, i) => (
                      <div key={i} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1.5">
                        <span className="text-xs text-gray-700">{m.item} — {m.qty} {m.notes && `(${m.notes})`}</span>
                        <button onClick={() => setMovementItems(movementItems.filter((_, idx) => idx !== i))}
                          className="rounded p-0.5 text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="Item" value={newMovement.item} onChange={(e) => setNewMovement({ ...newMovement, item: e.target.value })}
                    className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
                  <input placeholder="Qty" value={newMovement.qty} onChange={(e) => setNewMovement({ ...newMovement, qty: e.target.value })}
                    className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
                  <input placeholder="Notes" value={newMovement.notes} onChange={(e) => setNewMovement({ ...newMovement, notes: e.target.value })}
                    className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
                </div>
                <button onClick={() => {
                  if (newMovement.item && newMovement.qty) {
                    setMovementItems([...movementItems, newMovement])
                    setNewMovement({ item: '', qty: '', notes: '' })
                    toast.success(`${movementType} item added`)
                  }
                }} className="mt-2 flex h-8 items-center gap-1 rounded-lg bg-maroon px-3 text-xs font-bold text-white hover:bg-maroon-dark">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
          </div>
        </WorkflowSection>
      )}

      {/* === WAREHOUSE / THOL SECTION (post-confirm only) === */}
      {isPostConfirm && isWarehouse && (
        <WorkflowSection icon={Package} iconColor="text-emerald-500" title="Warehouse (THOL) — Dispatch & Returns"
          visibleRoles={['warehouse']} role={role}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Dispatch tracking */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Dispatch Items</p>
              {dispatchItems.length > 0 && (
                <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        {['Item', 'Qty', 'Status', ''].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dispatchItems.map((d, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-3 py-2 text-xs font-medium text-gray-900">{d.item}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{d.qty}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              d.status === 'Dispatched' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>{d.status}</span>
                          </td>
                          <td className="px-3 py-2">
                            <button onClick={() => setDispatchItems(dispatchItems.filter((_, idx) => idx !== i))}
                              className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Item" value={newDispatch.item} onChange={(e) => setNewDispatch({ ...newDispatch, item: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
                <input placeholder="Qty" value={newDispatch.qty} onChange={(e) => setNewDispatch({ ...newDispatch, qty: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
                <select value={newDispatch.status} onChange={(e) => setNewDispatch({ ...newDispatch, status: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs">
                  <option>Pending</option><option>Dispatched</option>
                </select>
              </div>
              <button onClick={() => {
                if (newDispatch.item && newDispatch.qty) {
                  setDispatchItems([...dispatchItems, newDispatch])
                  setNewDispatch({ item: '', qty: '', status: 'Pending' })
                  toast.success('Item added to dispatch')
                }
              }} className="mt-2 flex h-8 items-center gap-1 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-white hover:bg-emerald-600">
                <Plus size={12} /> Add Dispatch Item
              </button>
            </div>

            {/* Return form */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Return Items</p>
              {returnItems.length > 0 && (
                <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        {['Item', 'Sent', 'Returned', 'Reason', ''].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-3 py-2 text-xs font-medium text-gray-900">{r.item}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{r.qtySent}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{r.qtyReturned}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{r.reason}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => setReturnItems(returnItems.filter((_, idx) => idx !== i))}
                              className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Item" value={newReturn.item} onChange={(e) => setNewReturn({ ...newReturn, item: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
                <input placeholder="Qty Sent" value={newReturn.qtySent} onChange={(e) => setNewReturn({ ...newReturn, qtySent: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
                <input placeholder="Qty Returned" value={newReturn.qtyReturned} onChange={(e) => setNewReturn({ ...newReturn, qtyReturned: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
                <input placeholder="Reason" value={newReturn.reason} onChange={(e) => setNewReturn({ ...newReturn, reason: e.target.value })}
                  className="h-8 rounded border border-gray-200 bg-white px-2 text-xs" />
              </div>
              <button onClick={() => {
                if (newReturn.item && newReturn.qtyReturned) {
                  setReturnItems([...returnItems, newReturn])
                  setNewReturn({ item: '', qtySent: '', qtyReturned: '', reason: '' })
                  toast.success('Return item added')
                }
              }} className="mt-2 flex h-8 items-center gap-1 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600">
                <Plus size={12} /> Add Return
              </button>
            </div>
          </div>
        </WorkflowSection>
      )}

      {/* === REPORTS SECTION (admin only, post-confirm) === */}
      {isPostConfirm && isAdmin && (
        <WorkflowSection icon={BarChart3} iconColor="text-blue-500" title="Reports — Summary"
          visibleRoles={['admin']} role={role}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <ReportCard label="Menu" value={menuFile ? 'Uploaded' : 'Pending'} color={menuFile ? 'text-emerald-600' : 'text-amber-600'} />
            <ReportCard label="Presentation" value={presentationFile ? 'Uploaded' : 'Pending'} color={presentationFile ? 'text-emerald-600' : 'text-amber-600'} />
            <ReportCard label="Ingredients" value={`${ingredients.length} items`} color={ingredients.length > 0 ? 'text-emerald-600' : 'text-amber-600'} />
            <ReportCard label="Dispatched" value={`${dispatchItems.filter((d) => d.status === 'Dispatched').length}/${dispatchItems.length}`} color="text-blue-600" />
          </div>
          {movementItems.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Movements</p>
              <div className="grid grid-cols-3 gap-3">
                {(['return', 'transfer', 'wastage'] as const).map((t) => {
                  const items = movementItems.filter(() => movementType === t)
                  return (
                    <div key={t} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs font-semibold text-gray-900 capitalize">{t}</p>
                      <p className="text-lg font-bold text-gray-900">{items.length}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {returnItems.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Warehouse Returns</p>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm text-gray-600">{returnItems.length} item(s) returned</p>
              </div>
            </div>
          )}
        </WorkflowSection>
      )}

      {/* === VIEW MODALS === */}
      <ViewModal isOpen={viewMenu} onClose={() => setViewMenu(false)} title="Menu">
        {menuFile ? (
          <div className="text-center py-8">
            <FileText size={32} className="mx-auto mb-3 text-emerald-500" />
            <p className="text-sm font-semibold text-gray-900">{menuFile}</p>
            <p className="text-xs text-gray-400 mt-1">Menu file uploaded by Menu Planner</p>
          </div>
        ) : <p className="text-sm text-gray-400 text-center py-8">No menu uploaded</p>}
      </ViewModal>

      <ViewModal isOpen={viewPresentation} onClose={() => setViewPresentation(false)} title="Presentation">
        {presentationFile ? (
          <div className="text-center py-8">
            <FileText size={32} className="mx-auto mb-3 text-indigo-500" />
            <p className="text-sm font-semibold text-gray-900">{presentationFile}</p>
            <p className="text-xs text-gray-400 mt-1">Presentation uploaded by Presentation Exec</p>
          </div>
        ) : <p className="text-sm text-gray-400 text-center py-8">No presentation uploaded</p>}
      </ViewModal>

      <ViewModal isOpen={viewIngredients} onClose={() => setViewIngredients(false)} title="Ingredient List">
        {ingredients.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {['Item', 'Qty', 'Unit', 'Priority'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-3 py-2 text-xs font-medium text-gray-900">{ing.item}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{ing.qty}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{ing.unit}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      ing.priority === 'High' ? 'bg-red-100 text-red-700' :
                      ing.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>{ing.priority}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No ingredient list uploaded yet</p>
        )}
      </ViewModal>

      <ViewModal isOpen={viewDispatch} onClose={() => setViewDispatch(false)} title="Dispatch Status">
        {dispatchItems.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {['Item', 'Qty', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispatchItems.map((d, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-3 py-2 text-xs font-medium text-gray-900">{d.item}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{d.qty}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      d.status === 'Dispatched' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No dispatch items yet</p>
        )}
      </ViewModal>
    </div>
  )
}

/* === Helper Components === */

function WorkflowSection({ icon: Icon, iconColor, title, visibleRoles, role, children }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconColor: string
  title: string
  visibleRoles: string[]
  role: string
  children: React.ReactNode
}) {
  if (!visibleRoles.includes(role)) return null
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
        <Icon size={16} className={iconColor} /> {title}
      </h3>
      {children}
    </motion.div>
  )
}

function ReportCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

function ViewModal({ isOpen, onClose, title, children }: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
