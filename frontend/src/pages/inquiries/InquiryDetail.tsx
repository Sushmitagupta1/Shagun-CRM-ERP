import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInquiry, updateInquiryStatus, exportSingleInquiryExcel, updateInquiry, getFollowUps, addFollowUp, uploadInquiryFile, downloadInquiryFile, getMeetings, addMeeting, updateMeetingStatus } from '@/api/inquiries'
import PageHeader from '@/components/common/PageHeader'
import StatusPill from '@/components/common/StatusPill'
import { INQUIRY_STATUSES, PAYMENT_STATUSES } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  FileSpreadsheet,
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
  Save,
  Edit3,
  Download,
} from 'lucide-react'

const VALID_TRANSITIONS: Record<string, string[]> = {
  new_inquiry: ['followup'],
  followup: ['menu_sent', 'new_inquiry'],
  menu_sent: ['client_confirmation', 'followup'],
  client_confirmation: ['advance_receive', 'menu_sent'],
  advance_receive: ['operation_handover', 'client_confirmation'],
  operation_handover: [],
}

const PROGRESS_STEPS = [
  { key: 'new_inquiry', label: 'New Inquiry' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'menu_sent', label: 'Menu Sent' },
  { key: 'client_confirmation', label: 'Client Confirmation' },
  { key: 'advance_receive', label: 'Advance Received' },
  { key: 'operation_handover', label: 'Operation Handover' },
]

const PROGRESS_ORDER = ['new_inquiry', 'followup', 'menu_sent', 'client_confirmation', 'advance_receive', 'operation_handover']

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
  const token = localStorage.getItem('access_token')

  const role = user?.role.name ?? ''
  const isAdmin = role === 'admin'
  const isSalesHead = role === 'sales_head'
  const isMenuPlanner = role === 'menu_planner'
  const isPresentationExec = role === 'presentation_exec'
  const isKitchen = role === 'kitchen'
  const isOps = role === 'operations_manager'
  const isWarehouse = role === 'warehouse'

  const { data: inquiry, isLoading, refetch } = useQuery({
    queryKey: ['inquiry', id],
    queryFn: () => getInquiry(id!),
    enabled: !!id,
  })

  const { data: followUps = [], refetch: refetchFollowUps } = useQuery({
    queryKey: ['follow-ups', id],
    queryFn: () => getFollowUps(id!),
    enabled: !!id,
  })

  const addFollowUpMutation = useMutation({
    mutationFn: (data: { follow_up_date: string; remarks?: string }) => addFollowUp(id!, data),
    onSuccess: () => {
      refetchFollowUps()
      queryClient.invalidateQueries({ queryKey: ['inquiry', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'sales'] })
      toast.success('Follow-up added')
    },
    onError: () => toast.error('Failed to add follow-up'),
  })

  const { data: meetings = [], refetch: refetchMeetings } = useQuery({
    queryKey: ['meetings', id],
    queryFn: () => getMeetings(id!),
    enabled: !!id,
  })

  const addMeetingMutation = useMutation({
    mutationFn: (data: { meeting_at: string; remarks?: string }) => addMeeting(id!, data),
    onSuccess: () => {
      refetchMeetings()
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'presentation'] })
      toast.success('Meeting added')
    },
    onError: () => toast.error('Failed to add meeting'),
  })

  const completeMeetingMutation = useMutation({
    mutationFn: ({ meetingId }: { meetingId: string }) => updateMeetingStatus(id!, meetingId, 'completed'),
    onSuccess: () => {
      refetchMeetings()
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'presentation'] })
      toast.success('Meeting marked complete')
    },
    onError: () => toast.error('Failed to update meeting'),
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

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateInquiry(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiry', id] })
      toast.success('Inquiry updated')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to update'
      toast.error(message)
    },
  })

  const [stage2Edit, setStage2Edit] = useState(false)
  const [stage2Form, setStage2Form] = useState({
    per_plate_rate: 0,
    add_on: 0,
    advance_amount: 0,
    method: '',
    method_details: '',
    advance_payment_date: '',
    remaining_payment_date: '',
  })
  const [showAddFollowUp, setShowAddFollowUp] = useState(false)
  const [newFollowUpDate, setNewFollowUpDate] = useState('')
  const [newFollowUpRemarks, setNewFollowUpRemarks] = useState('')
  const [showAddMeeting, setShowAddMeeting] = useState(false)
  const [newMeetingDate, setNewMeetingDate] = useState('')
  const [newMeetingTime, setNewMeetingTime] = useState('')
  const [newMeetingRemarks, setNewMeetingRemarks] = useState('')

  const menuFile = inquiry?.menu_file_name || (inquiry?.menu_content ? 'Menu.txt' : null)
  const presentationFile = inquiry?.presentation_file_name || null
  const [ingredientFile, setIngredientFile] = useState<string | null>(null)
  const [showMenuUpload, setShowMenuUpload] = useState(false)
  const [showPresentationUpload, setShowPresentationUpload] = useState(false)
  const [showIngredientUpload, setShowIngredientUpload] = useState(false)

  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [newIngredient, setNewIngredient] = useState<IngredientRow>({ item: '', qty: '', unit: 'kg', priority: 'Medium' })

  const [dispatchItems, setDispatchItems] = useState<DispatchRow[]>([])
  const [newDispatch, setNewDispatch] = useState<DispatchRow>({ item: '', qty: '', status: 'Pending' })

  const [returnItems, setReturnItems] = useState<ReturnRow[]>([])
  const [newReturn, setNewReturn] = useState<ReturnRow>({ item: '', qtySent: '', qtyReturned: '', reason: '' })

  const [movementType, setMovementType] = useState<'return' | 'transfer' | 'wastage'>('return')
  const [movementItems, setMovementItems] = useState<MovementRow[]>([])
  const [newMovement, setNewMovement] = useState<MovementRow>({ item: '', qty: '', notes: '' })

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

  const nextStatuses = (VALID_TRANSITIONS[inquiry.status] || []).filter(
    (s) => s !== 'menu_sent' || isAdmin || isMenuPlanner
  )
  const isStage2Reached = ['followup', 'menu_sent', 'client_confirmation', 'advance_receive', 'operation_handover'].includes(inquiry.status)
  const isOperationHandover = inquiry.status === 'operation_handover'

  const handleStatusChange = (status: string) => {
    statusMutation.mutate(status)
  }

  const openStage2Edit = () => {
    setStage2Form({
      per_plate_rate: inquiry.per_plate_rate ? Number(inquiry.per_plate_rate) : 0,
      add_on: inquiry.add_on ? Number(inquiry.add_on) : 0,
      advance_amount: inquiry.advance_amount ? Number(inquiry.advance_amount) : 0,
      method: inquiry.method || '',
      method_details: inquiry.method_details || '',
      advance_payment_date: inquiry.advance_payment_date || '',
      remaining_payment_date: inquiry.remaining_payment_date || '',
    })
    setStage2Edit(true)
  }

  const saveStage2 = () => {
    const payload: Record<string, unknown> = {}
    if (Number(stage2Form.per_plate_rate) !== Number(inquiry.per_plate_rate || 0)) payload.per_plate_rate = stage2Form.per_plate_rate || null
    if (Number(stage2Form.add_on) !== Number(inquiry.add_on || 0)) payload.add_on = stage2Form.add_on || null
    if (Number(stage2Form.advance_amount) !== Number(inquiry.advance_amount || 0)) payload.advance_amount = stage2Form.advance_amount || null
    if (stage2Form.method !== (inquiry.method || '')) payload.method = stage2Form.method || null
    if (stage2Form.method_details !== (inquiry.method_details || '')) payload.method_details = stage2Form.method_details || null
    if (stage2Form.advance_payment_date !== (inquiry.advance_payment_date || '')) payload.advance_payment_date = stage2Form.advance_payment_date || null
    if (stage2Form.remaining_payment_date !== (inquiry.remaining_payment_date || '')) payload.remaining_payment_date = stage2Form.remaining_payment_date || null
    if (Object.keys(payload).length > 0) {
      updateMutation.mutate(payload, { onSuccess: () => setStage2Edit(false) })
    } else {
      setStage2Edit(false)
    }
  }

  const progressIndex = PROGRESS_ORDER.indexOf(inquiry.status)

  const handleDownloadMenu = async () => {
    try {
      const res = await fetch(`/api/inquiries/${id}/menu/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) { toast.error('Failed to download'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `Menu_${inquiry.client_name.replace(/\s+/g, '_')}.txt`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success('Menu downloaded')
    } catch { toast.error('Download failed') }
  }

  const handleFileUpload = async (type: 'menu' | 'presentation', file?: File) => {
    if (!file) return
    try {
      await uploadInquiryFile(id!, type, file)
      refetch()
      toast.success(`${type === 'menu' ? 'Menu' : 'Presentation'} uploaded`)
      if (type === 'menu') setShowMenuUpload(false)
      else setShowPresentationUpload(false)
    } catch (err) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Upload failed'
      toast.error(message)
    }
  }

  const handleIngredientUpload = () => {
    setIngredientFile(`Ingredient List_${inquiry.client_name.replace(/\s+/g, '_')}.xlsx`)
    toast.success('Ingredient list uploaded')
    setShowIngredientUpload(false)
  }

  const stage2Fields = [
    { label: 'Per Plate Rate', value: inquiry.per_plate_rate ? formatCurrency(Number(inquiry.per_plate_rate)) : '—', key: 'per_plate_rate' as const, type: 'number' },
    { label: 'Add-ons', value: inquiry.add_on ? formatCurrency(Number(inquiry.add_on)) : '—', key: 'add_on' as const, type: 'number' },
    { label: 'Total Amount', value: inquiry.total_amount ? formatCurrency(inquiry.total_amount) : '—', key: 'total_amount' as const, type: 'text', readOnly: true },
    { label: 'Advance Amount', value: inquiry.advance_amount ? formatCurrency(Number(inquiry.advance_amount)) : '—', key: 'advance_amount' as const, type: 'number' },
    { label: 'Payment Method', value: inquiry.method, key: 'method' as const, type: 'text' },
    { label: 'Method Details', value: inquiry.method_details, key: 'method_details' as const, type: 'text' },
    { label: 'Advance Payment Date', value: formatDate(inquiry.advance_payment_date), key: 'advance_payment_date' as const, type: 'date' },
    { label: 'Remaining Payment Due Date', value: formatDate(inquiry.remaining_payment_date), key: 'remaining_payment_date' as const, type: 'date' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={isOperationHandover ? `Event — ${inquiry.client_name}` : `Inquiry — ${inquiry.client_name}`}
        subtitle={isOperationHandover ? 'Handed over to operations' : undefined}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/inquiries')}
              className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => exportSingleInquiryExcel(inquiry.id)}
              className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
          </div>
        }
      />

      {/* Progress Bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-gray-100 bg-white p-4 shadow-md">
        <div className="flex items-center justify-between">
          {PROGRESS_STEPS.map((step, i) => {
            const isReached = i <= progressIndex
            const isActive = inquiry.status === step.key
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
                  <div className={`mx-1 mt-[-16px] h-0.5 flex-1 rounded ${isReached && i < progressIndex ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Stage 1: Basic Inquiry Details + Status + Follow-up History */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold text-gray-900">Stage 1 — Basic Information</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Client Name', value: inquiry.client_name },
              { label: 'Phone', value: inquiry.client_phone },
              { label: 'Event Type', value: inquiry.event_type },
              { label: 'Event Date', value: formatDate(inquiry.event_date) },
              { label: 'Pax', value: inquiry.pax ?? '—' },
              { label: 'Inquiry Date', value: formatDate(inquiry.inquiry_date) },
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

        <div className="space-y-4">
          {/* Status Card */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
            <h3 className="mb-4 text-sm font-bold text-gray-900">Status</h3>
            <div className="mb-4">
              <p className="mb-1 text-xs text-gray-500">Current Status</p>
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
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Update Status</p>
                {nextStatuses.map((status) => {
                  const cannotProceed = statusMutation.isPending
                  const isCancel = inquiry.status === 'followup' && status === 'new_inquiry'
                  return (
                    <button key={status} onClick={() => handleStatusChange(status)}
                      disabled={cannotProceed}
                      className={`flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ${
                        isCancel ? 'border border-red-200 bg-white text-red-600 hover:bg-red-50' :
                        status === 'operation_handover' ? 'bg-teal-500 text-white hover:bg-teal-600' :
                        'bg-maroon text-white hover:bg-maroon-dark'
                      } disabled:opacity-50`}>
                      {statusMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                      {isCancel ? 'Cancel' : INQUIRY_STATUSES[status as keyof typeof INQUIRY_STATUSES]?.label ?? status}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Follow-ups Section */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  Follow-ups
                </h3>
                <button
                  onClick={() => setShowAddFollowUp(!showAddFollowUp)}
                  className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <Plus size={14} /> Add
                </button>
              </div>

              {showAddFollowUp && (
                <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Date *</label>
                      <input type="date" value={newFollowUpDate}
                        onChange={(e) => setNewFollowUpDate(e.target.value)}
                        className="h-8 rounded-lg border border-gray-200 px-2 text-sm" />
                    </div>
                    <div className="min-w-[160px] flex-1">
                      <label className="mb-1 block text-xs font-medium text-gray-600">Remarks</label>
                      <input value={newFollowUpRemarks}
                        onChange={(e) => setNewFollowUpRemarks(e.target.value)}
                        placeholder="Call notes..."
                        className="h-8 w-full rounded-lg border border-gray-200 px-2 text-sm" />
                    </div>
                    <button
                      onClick={() => {
                        if (!newFollowUpDate) return
                        addFollowUpMutation.mutate(
                          { follow_up_date: newFollowUpDate, remarks: newFollowUpRemarks || undefined },
                          { onSuccess: () => { setShowAddFollowUp(false); setNewFollowUpDate(''); setNewFollowUpRemarks('') } }
                        )
                      }}
                      disabled={!newFollowUpDate || addFollowUpMutation.isPending}
                      className="flex h-8 items-center gap-1 rounded-lg bg-maroon px-3 text-xs font-bold text-white transition-colors hover:bg-maroon-dark disabled:opacity-50"
                    >
                      {addFollowUpMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {followUps.length === 0 ? (
                <p className="text-xs text-gray-400">No follow-ups yet.</p>
              ) : (
                <div className="space-y-2">
                  {followUps.map((fu) => (
                    <div key={fu.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                        {new Date(fu.follow_up_date).getDate()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(fu.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {fu.remarks && <p className="mt-0.5 text-xs text-gray-500">{fu.remarks}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stage 2: Client Confirmation & Payment Details */}
      {(isStage2Reached || (isAdmin && inquiry.method)) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Stage 2 — Confirmation & Payment Details</h3>
            {(isAdmin || isSalesHead) && !stage2Edit && (
              <button onClick={openStage2Edit}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
                <Edit3 size={12} /> Edit
              </button>
            )}
          </div>

          {stage2Edit ? (
            <div className="grid grid-cols-2 gap-4">
              {stage2Fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs text-gray-500">{f.label}</label>
                  {f.key === 'total_amount' ? (
                    <input type="text" value={f.value} readOnly
                      className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500" />
                  ) : f.type === 'date' ? (
                    <input type="date" value={stage2Form[f.key] as string}
                      onChange={(e) => setStage2Form({ ...stage2Form, [f.key]: e.target.value })}
                      className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm" />
                  ) : (
                    <input type={f.type} value={stage2Form[f.key] as string | number}
                      onChange={(e) => setStage2Form({ ...stage2Form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm" />
                  )}
                </div>
              ))}
              <div className="col-span-2 flex gap-2">
                <button onClick={saveStage2} disabled={updateMutation.isPending}
                  className="flex h-9 items-center gap-2 rounded-lg bg-maroon px-4 text-sm font-bold text-white hover:bg-maroon-dark disabled:opacity-50">
                  {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </button>
                <button onClick={() => setStage2Edit(false)}
                  className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {stage2Fields.map((f) => (
                <div key={f.label}>
                  <p className="text-xs text-gray-500">{f.label}</p>
                  <p className="text-sm font-medium text-gray-900">{f.value || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* === MENU SECTION === */}
      {(inquiry.menu_content || menuFile || isAdmin || isMenuPlanner) && (
        <WorkflowSection icon={ChefHat} iconColor="text-purple-500" title="Menu"
          visibleRoles={['menu_planner', 'kitchen', 'operations_manager', 'warehouse', 'admin', 'sales_head', 'presentation_exec']}
          role={role}>
          <div className="flex items-center justify-between">
            <div>
              {inquiry.menu_content || menuFile ? (
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-emerald-500" />
                  <span className="text-sm font-medium text-gray-900">{menuFile || 'Menu.txt'}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Uploaded</span>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No menu uploaded yet</p>
              )}
            </div>
            <div className="flex gap-2">
              {inquiry.menu_content && (
                <button onClick={handleDownloadMenu}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
                  <Download size={14} /> Download TXT
                </button>
              )}
              {inquiry.menu_file_name && (
                <button onClick={() => downloadInquiryFile(id!, 'menu', inquiry.menu_file_name)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
                  <Download size={14} /> Download File
                </button>
              )}
              {(isAdmin || isMenuPlanner) && (
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
                <p className="mb-2 text-xs font-medium text-gray-600">Upload menu file (Excel/PDF/PPT/Images)</p>
                <label className="flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 text-xs font-medium text-gray-600 hover:border-maroon hover:text-maroon">
                  <Upload size={14} /> Choose file
                  <input type="file" className="hidden"
                    onChange={(e) => {
                      handleFileUpload('menu', e.target.files?.[0])
                      e.target.value = ''
                    }} />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </WorkflowSection>
      )}

      {/* === PRESENTATION SECTION === */}
      {(presentationFile || isAdmin || isPresentationExec) && (
        <WorkflowSection icon={Presentation} iconColor="text-indigo-500" title="Presentation"
          visibleRoles={['presentation_exec', 'kitchen', 'operations_manager', 'warehouse', 'admin', 'sales_head', 'menu_planner']}
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
                <button onClick={() => downloadInquiryFile(id!, 'presentation', presentationFile)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
                  <Download size={14} /> Download
                </button>
              )}
              {(isAdmin || isPresentationExec) && (
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
                <p className="mb-2 text-xs font-medium text-gray-600">Upload presentation/theme file (Excel/PPT/PDF/Images)</p>
                <label className="flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 text-xs font-medium text-gray-600 hover:border-maroon hover:text-maroon">
                  <Upload size={14} /> Choose file
                  <input type="file" className="hidden"
                    onChange={(e) => {
                      handleFileUpload('presentation', e.target.files?.[0])
                      e.target.value = ''
                    }} />
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Meetings</h4>
              {(isAdmin || isPresentationExec) && (
                <button onClick={() => setShowAddMeeting(!showAddMeeting)}
                  className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
                  <Plus size={14} /> Add Meeting
                </button>
              )}
            </div>

            {showAddMeeting && (
              <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Date *</label>
                    <input type="date" value={newMeetingDate} onChange={(e) => setNewMeetingDate(e.target.value)}
                      className="h-8 rounded-lg border border-gray-200 px-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Time *</label>
                    <input type="time" value={newMeetingTime} onChange={(e) => setNewMeetingTime(e.target.value)}
                      className="h-8 rounded-lg border border-gray-200 px-2 text-sm" />
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Remark</label>
                    <input value={newMeetingRemarks} onChange={(e) => setNewMeetingRemarks(e.target.value)}
                      placeholder="Meeting notes..."
                      className="h-8 w-full rounded-lg border border-gray-200 px-2 text-sm" />
                  </div>
                  <button
                    onClick={() => {
                      if (!newMeetingDate || !newMeetingTime) return
                      addMeetingMutation.mutate(
                        { meeting_at: `${newMeetingDate}T${newMeetingTime}`, remarks: newMeetingRemarks || undefined },
                        { onSuccess: () => { setShowAddMeeting(false); setNewMeetingDate(''); setNewMeetingTime(''); setNewMeetingRemarks('') } }
                      )
                    }}
                    disabled={!newMeetingDate || !newMeetingTime || addMeetingMutation.isPending}
                    className="flex h-8 items-center gap-1 rounded-lg bg-maroon px-3 text-xs font-bold text-white transition-colors hover:bg-maroon-dark disabled:opacity-50"
                  >
                    {addMeetingMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {meetings.length === 0 ? (
              <p className="text-xs text-gray-400">No meetings scheduled yet.</p>
            ) : (
              <div className="space-y-2">
                {meetings.map((mtg) => {
                  const d = new Date(mtg.meeting_at)
                  const done = mtg.status === 'completed'
                  return (
                    <div key={mtg.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {done ? <CheckCircle2 size={14} /> : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          <span className="ml-1 text-xs font-normal text-gray-400">
                            · {d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </p>
                        {mtg.remarks && <p className="mt-0.5 text-xs text-gray-500">{mtg.remarks}</p>}
                      </div>
                      {!done && (isAdmin || isPresentationExec) && (
                        <button onClick={() => completeMeetingMutation.mutate({ meetingId: mtg.id })}
                          disabled={completeMeetingMutation.isPending}
                          className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2 text-[10px] font-medium text-gray-600 hover:bg-emerald-50">
                          <CheckCircle2 size={11} /> Mark done
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </WorkflowSection>
      )}

      {/* === KITCHEN SECTION (operation_handover only) === */}
      {isOperationHandover && isKitchen && (
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
                <button onClick={handleIngredientUpload}
                  className="flex h-8 items-center gap-1 rounded-lg bg-maroon px-3 text-xs font-bold text-white hover:bg-maroon-dark">
                  <Upload size={12} /> Upload Excel
                </button>
              </div>
            </div>
          )}
        </WorkflowSection>
      )}

      {/* === OPERATIONS SECTION (operation_handover only) === */}
      {isOperationHandover && isOps && (
        <WorkflowSection icon={Truck} iconColor="text-blue-500" title="Operations — Coordination"
          visibleRoles={['operations_manager']} role={role}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                  {menuFile && (
                    <button onClick={() => downloadInquiryFile(id!, 'menu', menuFile)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                      <Download size={14} />
                    </button>
                  )}
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

      {/* === WAREHOUSE SECTION (operation_handover only) === */}
      {isOperationHandover && isWarehouse && (
        <WorkflowSection icon={Package} iconColor="text-emerald-500" title="Warehouse (THOL) — Dispatch & Returns"
          visibleRoles={['warehouse']} role={role}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

      {/* === REPORTS SECTION (admin only, operation_handover) === */}
      {isOperationHandover && isAdmin && (
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
