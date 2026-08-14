import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  CheckCircle2,
  Lock,
  FileText,
  Loader2,
  Truck,
  PackageCheck,
  Image as ImageIcon,
  Search,
  Eye as EyeIcon,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import {
  useEventDetail,
  useSaveVendors,
  useCompleteEvent,
  useUploadEventPhoto,
  usePatchInventoryItem,
  useReceiveAllInventory,
  useReturnAllInventory,
  useEventAudit,
} from '@/hooks/useEvents'
import { downloadInquiryFile, uploadInquiryFile, viewInquiryFile } from '@/api/inquiries'
import { getEventPhotoBlob, downloadEventPhoto } from '@/api/events'
import type { EventInventoryRow, EventPhotoRow, EventVendorRow } from '@/types/event'
import { getErrorMessage } from '@/lib/apiError'
import { INQUIRY_STATUSES } from '@/lib/constants'

const EDITABLE_ROLES = ['admin', 'operations_manager']
const VENDOR_EDIT_ROLES = ['admin', 'operations_manager', 'warehouse']
const OPERATIONS_ROLES = ['operations_manager', 'admin']
const KITCHEN_UPLOAD_ROLES = ['kitchen', 'admin']
const VENDOR_UPLOAD_ROLES = ['operations_manager', 'admin', 'warehouse']

const PHOTO_CATEGORIES = [
  { key: 'before_setup', label: 'Before Event' },
  { key: 'setup', label: 'Setup Photo' },
  { key: 'after_cleaning', label: 'After Event Cleaning' },
] as const

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-left">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 px-5 py-4">{children}</div>}
    </motion.div>
  )
}

function NumberCell({ value, disabled, onSave, allowEmpty }: { value: number | null; disabled: boolean; onSave: (v: number | null) => void; allowEmpty?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(String(value ?? ''))
  useEffect(() => { setDraft(String(value ?? '')) }, [value])

  if (disabled || !editing) {
    return (
      <button disabled={disabled} onClick={() => setEditing(true)}
        className="w-20 rounded border border-transparent px-2 py-1 text-left text-xs tabular-nums text-gray-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent">
        {value ?? '—'}
      </button>
    )
  }
  const commit = () => {
    const trimmed = draft.trim()
    setEditing(false)
    if (allowEmpty && trimmed === '') { onSave(null); return }
    const num = Number(trimmed)
    if (!Number.isFinite(num)) return
    if (num === value) return
    onSave(num)
  }
  return (
    <input autoFocus type="number" value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
      className="w-20 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none" />
  )
}

function TextCell({ value, disabled, onSave }: { value: string | null; disabled: boolean; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(value ?? '')
  useEffect(() => { setDraft(value ?? '') }, [value])

  if (disabled || !editing) {
    return (
      <button disabled={disabled} onClick={() => setEditing(true)}
        className="w-28 rounded border border-transparent px-2 py-1 text-left text-xs text-gray-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent">
        {value ?? '—'}
      </button>
    )
  }
  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed === (value ?? '')) return
    onSave(trimmed === '' ? null : trimmed)
  }
  return (
    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
      className="w-28 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none" />
  )
}

function RequiredQtyCell({ value, disabled, onSave }: { value: number; disabled: boolean; onSave: (v: number, remark: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [remark, setRemark] = useState('')
  useEffect(() => { setDraft(String(value)) }, [value])

  if (disabled || !editing) {
    return (
      <button disabled={disabled} onClick={() => setEditing(true)}
        className="w-20 rounded border border-transparent px-2 py-1 text-left text-xs tabular-nums text-gray-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent">
        {value}
      </button>
    )
  }
  const commit = () => {
    const num = Number(draft)
    if (!Number.isFinite(num)) return
    if (num === value && !remark.trim()) { setEditing(false); return }
    if (!remark.trim()) { toast.error('Remark is mandatory when changing required qty'); return }
    setEditing(false)
    setRemark('')
    onSave(num, remark.trim())
  }
  return (
    <div className="flex items-center gap-1">
      <input autoFocus type="number" value={draft} onChange={(e) => setDraft(e.target.value)}
        className="w-16 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:outline-none" />
      <input placeholder="Remark (required)" value={remark} onChange={(e) => setRemark(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
        className="w-32 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:outline-none" />
      <button onClick={commit} className="rounded bg-maroon px-2 py-1 text-[10px] font-bold text-white">Save</button>
    </div>
  )
}

function PhotoThumb({ eventId, photo, onDownload }: { eventId: string; photo: EventPhotoRow; onDownload: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    getEventPhotoBlob(eventId, photo.id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = window.URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setUrl(null) })
    return () => {
      cancelled = true
      if (objectUrl) window.URL.revokeObjectURL(objectUrl)
    }
  }, [eventId, photo.id])
  return (
    <div className="group relative">
      {url ? (
        <img src={url} alt={photo.file_name} className="h-24 w-24 rounded-lg border border-gray-200 object-cover" />
      ) : (
        <div className="h-24 w-24 rounded-lg border border-dashed border-gray-300 bg-gray-50" />
      )}
      <button
        onClick={onDownload}
        title={photo.file_name}
        className="mt-1 flex w-24 items-center justify-center gap-1 rounded border border-gray-200 px-1 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50"
      >
        <Download size={10} /> Download
      </button>
    </div>
  )
}

export default function EventView() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role?.name ?? ''
  const { data, isLoading, refetch } = useEventDetail(id)
  const patchItem = usePatchInventoryItem(id)
  const receiveAll = useReceiveAllInventory(id)
  const returnAll = useReturnAllInventory(id)
  const { data: audit } = useEventAudit(id)
  const saveVendors = useSaveVendors(id)
  const complete = useCompleteEvent(id)
  const uploadPhoto = useUploadEventPhoto(id)

  const [inventorySearch, setInventorySearch] = useState('')
  const [vendorSearch, setVendorSearch] = useState('')

  const canEdit = !data?.is_completed && EDITABLE_ROLES.includes(role)
  const canEditVendors = !data?.is_completed && VENDOR_EDIT_ROLES.includes(role)
  const canComplete = !data?.is_completed && (role === 'operations_manager' || role === 'admin')

  const [vendorRows, setVendorRows] = useState<EventVendorRow[]>([])
  const [savedVendors, setSavedVendors] = useState<EventVendorRow[]>([])

  useEffect(() => {
    if (data) {
      setVendorRows(data.vendors)
      setSavedVendors(JSON.parse(JSON.stringify(data.vendors)))
    }
  }, [data])

  const updateVendor = (vid: string, patch: Partial<EventVendorRow>) => {
    setVendorRows((prev) => prev.map((v) => (v.id === vid ? { ...v, ...patch } : v)))
  }

  const handleUpload = async (fileType: 'vendor' | 'kitchen_inventory', file?: File) => {
    if (!file) return
    try {
      await uploadInquiryFile(id, fileType, file)
      toast.success(`${fileType === 'vendor' ? 'Vendor' : 'Kitchen inventory'} excel uploaded`)
      refetch()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'))
    }
  }

  const saveField = (row: EventInventoryRow, field: string, value: number | string | null, remark?: string) => {
    patchItem.mutate({ item_name: row.item_name, field, value, remark: remark ?? null }, {
      onSuccess: () => toast.success('Saved'),
      onError: (err) => toast.error(getErrorMessage(err, 'Save failed')),
    })
  }

  const handleIngredientUpload = async (file?: File) => {
    if (!file) return
    try {
      await uploadInquiryFile(id, 'ingredient', file)
      toast.success('Ingredient excel uploaded')
      refetch()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'))
    }
  }

  const handleReceiveAll = () => {
    if (!window.confirm('Mark all inventory items as received? Items with a Not Received count are adjusted automatically.')) return
    receiveAll.mutate(undefined, {
      onSuccess: () => toast.success('All inventory marked as received'),
      onError: (err) => toast.error(getErrorMessage(err, 'Action failed')),
    })
  }

  const handleReturnAll = () => {
    if (!window.confirm('Mark all items as returned to THOL? Returned Qty = Required - Not Received - Transferred.')) return
    returnAll.mutate(undefined, {
      onSuccess: () => toast.success('All items marked as returned to THOL'),
      onError: (err) => toast.error(getErrorMessage(err, 'Action failed')),
    })
  }

  const saveVendor = () => {
    const payload = vendorRows.map((v) => {
      const orig = savedVendors.find((s) => s.id === v.id)
      const changed = orig && (v.rate !== orig.rate || v.total_cost !== orig.total_cost || v.payment_status !== orig.payment_status)
      return { id: v.id, rate: changed ? v.rate : null, total_cost: changed ? v.total_cost : null, payment_status: changed ? v.payment_status : null, remark: v.remark }
    })
    const missing = payload.filter((p) => (p.rate !== null || p.total_cost !== null || p.payment_status !== null) && !(p.remark || '').trim())
    if (missing.length > 0) {
      toast.error('Remark is mandatory when changing vendor rate/cost/status')
      return
    }
    saveVendors.mutate(payload, {
      onSuccess: () => toast.success('Vendors saved'),
      onError: (err) => toast.error(getErrorMessage(err, 'Save failed')),
    })
  }

  const handleComplete = () => {
    if (!window.confirm('Mark this event as completed? All editing will be locked for everyone.')) return
    complete.mutate(undefined, {
      onSuccess: () => toast.success('Event marked as completed'),
      onError: (err) => toast.error(getErrorMessage(err, 'Failed to complete event')),
    })
  }

  const handlePhotoUpload = (category: string, file?: File) => {
    if (!file) return
    uploadPhoto.mutate({ category, file }, {
      onSuccess: () => toast.success('Photo uploaded'),
      onError: (err) => toast.error(getErrorMessage(err, 'Upload failed')),
    })
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400">Loading event...</div>
  }
  if (!data) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400">Event not found</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          {data.is_completed && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
              <Lock size={11} /> Event Completed — Read Only
            </span>
          )}
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
            INQUIRY_STATUSES[data.status as keyof typeof INQUIRY_STATUSES]?.color ?? 'bg-gray-100 text-gray-700'
          }`}>
            {INQUIRY_STATUSES[data.status as keyof typeof INQUIRY_STATUSES]?.label ?? data.status}
          </span>
        </div>
      </div>

      <PageHeader title={data.client_name} subtitle={`${data.event_type} · ${data.event_date ?? 'No date'} · Pax ${data.pax ?? '—'}`} />

      {/* 1. Event Details */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
        <h3 className="mb-4 text-sm font-bold text-gray-900">Event Details</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          {[
            ['Event Name', data.client_name],
            ['Event Date', data.event_date ?? '—'],
            ['Pax', data.pax ?? '—'],
            ['Event Type', data.event_type],
            ['Status', INQUIRY_STATUSES[data.status as keyof typeof INQUIRY_STATUSES]?.label ?? data.status],
            ['Client Name', data.client_name],
            ['Venue', data.venue ?? '—'],
            ['Sales Head', data.sales_head_name ?? '—'],
            ['Created Date', data.created_at ? new Date(data.created_at).toLocaleDateString('en-IN') : '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 2. Documents */}
      <Section title="Documents">
        {[
          { label: 'Menu', uploaded: data.menu.uploaded, file_name: data.menu.file_name, onDownload: () => data.menu.file_name && downloadInquiryFile(id, 'menu', data.menu.file_name) },
          { label: 'Presentation (PPT)', uploaded: Boolean(data.presentation_file_name), file_name: data.presentation_file_name, onDownload: () => data.presentation_file_name && downloadInquiryFile(id, 'presentation', data.presentation_file_name) },
          { label: 'Ingredient Request', uploaded: Boolean(data.ingredient_file_name), file_name: data.ingredient_file_name, onDownload: () => data.ingredient_file_name && downloadInquiryFile(id, 'ingredient', data.ingredient_file_name) },
          { label: 'Semi-finished Item List', uploaded: Boolean(data.kitchen_inventory_file_name), file_name: data.kitchen_inventory_file_name, onDownload: () => data.kitchen_inventory_file_name && downloadInquiryFile(id, 'kitchen_inventory', data.kitchen_inventory_file_name) },
        ].map((doc) => (
          <div key={doc.label} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-emerald-500" />
              <span className="text-xs font-semibold text-gray-900">{doc.label}</span>
              {doc.uploaded ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Ready</span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={doc.onDownload}
                disabled={!doc.uploaded}
                className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-medium hover:bg-gray-50 disabled:opacity-40"
              >
                <Download size={12} /> Download
              </button>
            </div>
          </div>
        ))}
      </Section>

      {/* 3. Inventory List */}
      <Section title="Inventory List">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              placeholder="Search items…"
              className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          {OPERATIONS_ROLES.includes(role) && !data.is_completed && (
            <>
              <button onClick={handleReceiveAll} disabled={receiveAll.isPending}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {receiveAll.isPending ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={12} />} Received All Inventory
              </button>
              <button onClick={handleReturnAll} disabled={returnAll.isPending}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {returnAll.isPending ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />} All Items Returned to THOL
              </button>
            </>
          )}
          {data.ingredient_file_name && (
            <button onClick={() => viewInquiryFile(id, 'ingredient')}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <FileText size={12} /> View Excel
            </button>
          )}
          {data.ingredient_file_name && (
            <button onClick={() => downloadInquiryFile(id, 'ingredient', data.ingredient_file_name)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <Download size={12} /> Download Excel
            </button>
          )}
          {KITCHEN_UPLOAD_ROLES.includes(role) && !data.is_completed && (
            <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
              <Upload size={12} /> Upload Excel
              <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => { handleIngredientUpload(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Sr No', 'Item Name', 'Required Qty', 'Received Qty', 'Not Received Item Count', 'Received Status', 'Transfer Item Count', 'Transfer Event Name', 'Returned to THOL Qty', 'Breakage / Missing', 'Remark'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.inventory.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-xs text-gray-400">No inventory yet — upload the kitchen's Ingredient Excel to populate Required Qty.</td></tr>
              ) : data.inventory
                .filter((row) => row.item_name.toLowerCase().includes(inventorySearch.toLowerCase()))
                .map((row) => (
                  <tr key={row.item_name} className="border-b border-gray-50">
                    <td className="px-3 py-2.5 text-xs text-gray-500">{row.sr_no}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{row.item_name}</td>
                    <td className="px-3 py-2.5">
                      <RequiredQtyCell value={row.required_qty} disabled={!canEdit}
                        onSave={(v, remark) => saveField(row, 'required_qty', v, remark)} />
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold tabular-nums text-gray-700">{row.received_qty} {row.unit ?? ''}</td>
                    <td className="px-3 py-2.5">
                      <NumberCell value={row.not_received_count} disabled={!canEdit}
                        onSave={(v) => saveField(row, 'not_received_count', v)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        row.received_tag === 'Yes' ? 'bg-emerald-100 text-emerald-700'
                        : row.received_tag === 'Half' ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>{row.received_tag}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <NumberCell value={row.transfer_count} disabled={!canEdit}
                        onSave={(v) => saveField(row, 'transfer_count', v)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <TextCell value={row.transfer_event} disabled={!canEdit}
                        onSave={(v) => saveField(row, 'transfer_event', v)} />
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold tabular-nums text-gray-700">{row.returned_qty}</td>
                    <td className="px-3 py-2.5">
                      <NumberCell value={row.breakage_count} disabled={!canEdit}
                        onSave={(v) => saveField(row, 'breakage_count', v)} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{row.remark ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 4. Vendor Details */}
      <Section title="Vendor Details">
        <div className="relative mb-3 min-w-[220px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
            placeholder="Search vendors…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Sr No', 'Vendor Name', 'Service Name', 'Rate (₹)', 'Total Cost (₹)', 'Payment Status', 'Remark'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorRows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-gray-400">No vendors yet — upload a Vendor Excel.</td></tr>
              ) : vendorRows.filter((v) => v.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase())).map((v, i) => (
                <tr key={v.id} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{v.vendor_name}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{v.service_name ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <input type="number" disabled={!canEditVendors} value={v.rate ?? ''}
                      onChange={(e) => updateVendor(v.id, { rate: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-24 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500" />
                  </td>
                  <td className="px-3 py-2.5">
                    <input type="number" disabled={!canEditVendors} value={v.total_cost ?? ''}
                      onChange={(e) => updateVendor(v.id, { total_cost: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-24 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500" />
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      disabled={!canEditVendors}
                      value={v.payment_status}
                      onChange={(e) => updateVendor(v.id, { payment_status: e.target.value })}
                      className="rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <input value={v.remark ?? ''} disabled={!canEditVendors}
                      onChange={(e) => updateVendor(v.id, { remark: e.target.value })}
                      placeholder="Remark"
                      className="w-40 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500">Total Vendor Cost</td>
                <td className="px-3 py-2.5 text-sm font-bold tabular-nums text-gray-900">₹ {data.total_vendor_cost.toLocaleString('en-IN')}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {VENDOR_UPLOAD_ROLES.includes(role) && !data.is_completed && (
            <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
              <Upload size={12} /> Upload Vendor Excel
              <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => { handleUpload('vendor', e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )}
          {canEditVendors && (
            <button onClick={saveVendor} disabled={saveVendors.isPending}
              className="flex items-center gap-1 rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white hover:bg-maroon-dark disabled:opacity-50">
              {saveVendors.isPending ? <Loader2 size={12} className="animate-spin" /> : null} Save Vendor Changes
            </button>
          )}
        </div>
      </Section>

      {/* 5. Kitchen Inventory */}
      <Section title="Kitchen Inventory">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Sr No', 'Item Name', 'Prepared Qty', 'Unit', 'Used Qty', 'Remaining Qty', 'Remark'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.kitchen_inventory.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-gray-400">No kitchen inventory uploaded yet.</td></tr>
              ) : data.kitchen_inventory.map((k, i) => (
                <tr key={k.id} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{k.item_name}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-700">{k.prepared_qty}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{k.unit ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-700">{k.used_qty}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-700">{k.remaining_qty}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{k.remark ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.kitchen_inventory_file_name && (
            <button onClick={() => viewInquiryFile(id, 'kitchen_inventory')}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <EyeIcon size={12} /> View Excel
            </button>
          )}
          {data.kitchen_inventory_file_name && (
            <button onClick={() => downloadInquiryFile(id, 'kitchen_inventory', data.kitchen_inventory_file_name)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <Download size={12} /> Download Excel
            </button>
          )}
          {KITCHEN_UPLOAD_ROLES.includes(role) && !data.is_completed && (
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
              <Upload size={12} /> Upload Kitchen Inventory Excel
              <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => { handleUpload('kitchen_inventory', e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )}
        </div>
      </Section>

      {/* 5d. Photos */}
      <Section title="Photos">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PHOTO_CATEGORIES.map((cat) => {
            const items = (data.photos ?? []).filter((p) => p.category === cat.key)
            return (
              <div key={cat.key} className="rounded-lg border border-gray-100 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                  <h4 className="flex items-center gap-1 text-xs font-bold text-gray-900"><ImageIcon size={12} /> {cat.label}</h4>
                  {OPERATIONS_ROLES.includes(role) && (
                    <label className="flex cursor-pointer items-center gap-1 rounded border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50">
                      <Upload size={10} /> Upload
                      <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp"
                        onChange={(e) => { handlePhotoUpload(cat.key, e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 p-3">
                  {items.length === 0 ? (
                    <p className="w-full py-4 text-center text-[11px] text-gray-400">No photos yet.</p>
                  ) : items.map((p) => (
                    <PhotoThumb key={p.id} eventId={id} photo={p} onDownload={() => downloadEventPhoto(id, p.id, p.file_name)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* 6. Inventory Closure Summary */}
      <Section title="Inventory Closure Summary">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Total Items', data.closure.total_items],
            ['Total Required Qty', data.closure.total_required_qty],
            ['Total Received Qty', data.closure.total_received_qty],
            ['Not Received Qty', data.closure.not_received_qty],
            ['Transferred Qty', data.closure.transferred_qty],
            ['Returned to THOL Qty', data.closure.returned_thol_qty],
            ['Breakage / Wastage', data.closure.wastage_qty],
            ['Pending Qty', data.closure.pending_qty],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-100 bg-cream p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 6b. Audit Trail */}
      <Section title="Audit Trail">
        {!audit || audit.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Time', 'User', 'Action', 'Type', 'Item', 'Field', 'From', 'To', 'Remark'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50">
                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-gray-600">{a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] font-medium text-gray-900">{a.user_name ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        a.action === 'upload' ? 'bg-blue-100 text-blue-700'
                        : a.action === 'complete' ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-700'
                      }`}>{a.action}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">{a.entity_type}</td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">{a.item_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">{a.field_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">{a.old_value ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] font-medium text-gray-900">{a.new_value ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-600">{a.remark ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 8. Mark Event as Completed */}
      {canComplete && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <button onClick={handleComplete} disabled={complete.isPending}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {complete.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Mark Event as Completed
          </button>
        </motion.div>
      )}
    </div>
  )
}
