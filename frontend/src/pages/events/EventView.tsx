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
  Send,
  Truck,
  PackageCheck,
  ArrowRightLeft,
  Image as ImageIcon,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useEventDetail, useSaveInventoryItems, useSaveVendors, useCompleteEvent, useCreateWarehouseRequests, useIssueWarehouseRequest, useReceiveWarehouseRequest, useUploadEventPhoto, useCreateTransfer, useEvents } from '@/hooks/useEvents'
import { downloadInquiryFile, uploadInquiryFile } from '@/api/inquiries'
import { downloadUploadVersion, getEventPhotoBlob, downloadEventPhoto } from '@/api/events'
import type { EventInventoryRow, EventPhotoRow, EventVendorRow } from '@/types/event'
import { getErrorMessage } from '@/lib/apiError'
import { INQUIRY_STATUSES } from '@/lib/constants'

const EDITABLE_ROLES = ['operations_manager', 'admin', 'warehouse']
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

function PhotoThumb({ eventId, photo, onDownload }: { eventId: string; photo: EventPhotoRow; onDownload: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let objectUrl: string | null = null
    getEventPhotoBlob(eventId, photo.id)
      .then((blob) => {
        objectUrl = window.URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => setUrl(null))
    return () => {
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
  const saveItems = useSaveInventoryItems(id)
  const saveVendors = useSaveVendors(id)
  const complete = useCompleteEvent(id)
  const createRequests = useCreateWarehouseRequests(id)
  const issueRequest = useIssueWarehouseRequest(id)
  const receiveRequest = useReceiveWarehouseRequest(id)
  const uploadPhoto = useUploadEventPhoto(id)
  const createTransfer = useCreateTransfer(id)
  const { data: allEvents } = useEvents()

  const [transferForm, setTransferForm] = useState({ item_name: '', quantity: 0, unit: '', to_inquiry_id: '' })

  const canEdit = !data?.is_completed && EDITABLE_ROLES.includes(role)
  const canComplete = !data?.is_completed && (role === 'operations_manager' || role === 'admin')

  const [inventoryRows, setInventoryRows] = useState<EventInventoryRow[]>([])
  const [vendorRows, setVendorRows] = useState<EventVendorRow[]>([])
  const [savedInventory, setSavedInventory] = useState<EventInventoryRow[]>([])
  const [savedVendors, setSavedVendors] = useState<EventVendorRow[]>([])

  useEffect(() => {
    if (data) {
      setInventoryRows(data.inventory)
      setVendorRows(data.vendors)
      setSavedInventory(JSON.parse(JSON.stringify(data.inventory)))
      setSavedVendors(JSON.parse(JSON.stringify(data.vendors)))
    }
  }, [data])

  const updateRow = (itemName: string, patch: Partial<EventInventoryRow>) => {
    setInventoryRows((prev) => prev.map((r) => (r.item_name === itemName ? { ...r, ...patch } : r)))
  }
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

  const saveInventory = () => {
    const payload = inventoryRows.map((r) => {
      const orig = savedInventory.find((s) => s.item_name === r.item_name)
      const changed =
        (orig && r.received_qty !== orig.received_qty) ||
        (orig && r.transfer_count !== orig.transfer_count) ||
        (orig && r.returned_qty !== orig.returned_qty)
      return {
        item_name: r.item_name,
        received_qty: changed ? r.received_qty : null,
        transfer_count: changed ? r.transfer_count : null,
        returned_qty: changed ? r.returned_qty : null,
        remark: r.remark,
      }
    })
    const missing = payload.filter((p) => (p.received_qty !== null || p.transfer_count !== null || p.returned_qty !== null) && !(p.remark || '').trim())
    if (missing.length > 0) {
      toast.error(`Remark is mandatory for: ${missing.map((m) => m.item_name).join(', ')}`)
      return
    }
    saveItems.mutate(payload, {
      onSuccess: () => toast.success('Inventory saved'),
      onError: (err) => toast.error(getErrorMessage(err, 'Save failed')),
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

  const handleSendToTHOL = () => {
    if (!window.confirm('Send the ingredient plan to THOL as a warehouse request?')) return
    createRequests.mutate({ from_ingredient: true }, {
      onSuccess: (res) => toast.success(`Warehouse request sent (${res.created} items)`),
      onError: (err) => toast.error(getErrorMessage(err, 'Failed to send request')),
    })
  }

  const handlePhotoUpload = (category: string, file?: File) => {
    if (!file) return
    uploadPhoto.mutate({ category, file }, {
      onSuccess: () => toast.success('Photo uploaded'),
      onError: (err) => toast.error(getErrorMessage(err, 'Upload failed')),
    })
  }

  const handleCreateTransfer = () => {
    if (!transferForm.item_name.trim() || transferForm.quantity <= 0 || !transferForm.to_inquiry_id) {
      toast.error('Item, quantity, and target event are required')
      return
    }
    createTransfer.mutate(
      {
        item_name: transferForm.item_name.trim(),
        quantity: transferForm.quantity,
        unit: transferForm.unit || null,
        to_inquiry_id: transferForm.to_inquiry_id,
      },
      {
        onSuccess: () => {
          toast.success('Transfer added')
          setTransferForm({ item_name: '', quantity: 0, unit: '', to_inquiry_id: '' })
        },
        onError: (err) => toast.error(getErrorMessage(err, 'Transfer failed')),
      },
    )
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400">Loading event...</div>
  }
  if (!data) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400">Event not found</div>
  }

  const invCols = ['Sr No', 'Item Name', 'Required Qty', 'Received Qty', 'Not Received Item Count', 'Received Status', 'Transfer Item Count', 'Returned to THOL Qty', 'Remark']

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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {invCols.map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventoryRows.length === 0 ? (
                <tr><td colSpan={invCols.length} className="px-3 py-10 text-center text-xs text-gray-400">No inventory yet — upload the kitchen's Ingredient Excel to populate Required Qty.</td></tr>
              ) : inventoryRows.map((row) => (
                <tr key={row.item_name} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500">{row.sr_no}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{row.item_name}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-700">{row.required_qty} {row.unit ?? ''}</td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={row.received_qty}
                      onChange={(e) => updateRow(row.item_name, { received_qty: Number(e.target.value) })}
                      className="w-20 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-600">{row.not_received_count}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      row.received_status === 'Received' ? 'bg-emerald-100 text-emerald-700'
                      : row.received_status === 'Partial' ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                    }`}>{row.received_status}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={row.transfer_count}
                      onChange={(e) => updateRow(row.item_name, { transfer_count: Number(e.target.value) })}
                      className="w-20 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={row.returned_qty}
                      onChange={(e) => updateRow(row.item_name, { returned_qty: Number(e.target.value) })}
                      className="w-20 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      value={row.remark ?? ''}
                      disabled={!canEdit}
                      onChange={(e) => updateRow(row.item_name, { remark: e.target.value })}
                      placeholder="Remark"
                      className="w-40 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <button onClick={saveInventory} disabled={saveItems.isPending}
            className="mt-4 flex items-center gap-1 rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white hover:bg-maroon-dark disabled:opacity-50">
            {saveItems.isPending ? <Loader2 size={12} className="animate-spin" /> : null} Save Inventory Changes
          </button>
        )}
      </Section>

      {/* 4. Vendor Details */}
      <Section title="Vendor Details">
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
              ) : vendorRows.map((v, i) => (
                <tr key={v.id} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{v.vendor_name}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{v.service_name ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <input type="number" disabled={!canEdit} value={v.rate ?? ''}
                      onChange={(e) => updateVendor(v.id, { rate: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-24 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500" />
                  </td>
                  <td className="px-3 py-2.5">
                    <input type="number" disabled={!canEdit} value={v.total_cost ?? ''}
                      onChange={(e) => updateVendor(v.id, { total_cost: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-24 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500" />
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      disabled={!canEdit}
                      value={v.payment_status}
                      onChange={(e) => updateVendor(v.id, { payment_status: e.target.value })}
                      className="rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <input value={v.remark ?? ''} disabled={!canEdit}
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
          {canEdit && (
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
        {KITCHEN_UPLOAD_ROLES.includes(role) && !data.is_completed && (
          <label className="mt-4 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
            <Upload size={12} /> Upload Kitchen Inventory Excel
            <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => { handleUpload('kitchen_inventory', e.target.files?.[0]); e.target.value = '' }} />
          </label>
        )}
      </Section>

      {/* 5b. Warehouse Requests */}
      <Section title="Warehouse Requests">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {canEdit && role === 'operations_manager' && !data.ingredient_file_name && (
            <p className="w-full text-xs text-amber-600">Upload the Ingredient Excel first, then send it to THOL.</p>
          )}
          {canEdit && (
            <button
              onClick={handleSendToTHOL}
              disabled={createRequests.isPending || !data.ingredient_file_name}
              className="flex items-center gap-1 rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white hover:bg-maroon-dark disabled:opacity-50"
            >
              {createRequests.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send Request to THOL
            </button>
          )}
        </div>
        {data.warehouse_requests.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No warehouse requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Item Name', 'Qty', 'Unit', 'Status', 'Requested By', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.warehouse_requests.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{r.item_name}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-gray-700">{r.quantity} {r.unit ?? ''}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{r.unit ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.status === 'received' ? 'bg-emerald-100 text-emerald-700'
                        : r.status === 'issued' ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{r.requested_by_name ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {role === 'warehouse' && !data.is_completed && r.status === 'pending' && (
                          <button
                            onClick={() => issueRequest.mutate(r.id, {
                              onSuccess: () => toast.success('Request issued'),
                              onError: (err) => toast.error(getErrorMessage(err, 'Issue failed')),
                            })}
                            disabled={issueRequest.isPending}
                            className="flex items-center gap-1 rounded border border-blue-200 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                          >
                            <Truck size={11} /> Issue
                          </button>
                        )}
                        {(role === 'operations_manager' || role === 'admin') && !data.is_completed && r.status !== 'received' && (
                          <button
                            onClick={() => receiveRequest.mutate(r.id, {
                              onSuccess: () => toast.success('Items received'),
                              onError: (err) => toast.error(getErrorMessage(err, 'Receive failed')),
                            })}
                            disabled={receiveRequest.isPending}
                            className="flex items-center gap-1 rounded border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <PackageCheck size={11} /> Receive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 5c. Transfer Panel */}
      <Section title="Transfer Panel">
        {canEdit && (
          <div className="mb-4 rounded-lg border border-gray-100 bg-cream p-3">
            <h4 className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <ArrowRightLeft size={11} /> Add Direct Transfer
            </h4>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Item Name</label>
                <input value={transferForm.item_name} onChange={(e) => setTransferForm((s) => ({ ...s, item_name: e.target.value }))}
                  className="mt-1 w-40 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Qty</label>
                <input type="number" value={transferForm.quantity} onChange={(e) => setTransferForm((s) => ({ ...s, quantity: Number(e.target.value) }))}
                  className="mt-1 w-20 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Unit</label>
                <input value={transferForm.unit} onChange={(e) => setTransferForm((s) => ({ ...s, unit: e.target.value }))}
                  className="mt-1 w-20 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Target Event</label>
                <select value={transferForm.to_inquiry_id} onChange={(e) => setTransferForm((s) => ({ ...s, to_inquiry_id: e.target.value }))}
                  className="mt-1 w-48 rounded border border-blue-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none">
                  <option value="">Select event…</option>
                  {(allEvents ?? []).filter((ev) => ev.id !== id).map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.client_name} — {ev.event_date ?? 'no date'}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleCreateTransfer} disabled={createTransfer.isPending}
                className="flex items-center gap-1 rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white hover:bg-maroon-dark disabled:opacity-50">
                {createTransfer.isPending ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />} Add
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { title: 'Items Returned', rows: data.returns, cols: ['Item', 'Qty', 'Event', 'Date'] },
            { title: 'Direct Transfers', rows: data.transfers, cols: ['Item', 'Qty', 'From', 'To', 'Date'] },
            { title: 'Wastage', rows: data.wastage_rows, cols: ['Item', 'Qty', 'Event', 'Date'] },
          ].map((panel) => (
            <div key={panel.title} className="rounded-lg border border-gray-100 bg-white">
              <div className="border-b border-gray-100 px-3 py-2">
                <h4 className="text-xs font-bold text-gray-900">{panel.title}</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {panel.cols.map((h) => (
                        <th key={h} className="px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {panel.rows.length === 0 ? (
                      <tr><td colSpan={panel.cols.length} className="px-2 py-6 text-center text-[11px] text-gray-400">None</td></tr>
                    ) : panel.rows.map((row: any) => (
                      <tr key={row.id} className="border-b border-gray-50">
                        <td className="px-2 py-2 text-[11px] font-medium text-gray-900">{row.item_name}</td>
                        <td className="px-2 py-2 text-[11px] tabular-nums text-gray-700">{row.quantity} {row.unit ?? ''}</td>
                        <td className="px-2 py-2 text-[11px] text-gray-600">{panel.title === 'Direct Transfers' ? row.from_event : row.from_event}</td>
                        {panel.title === 'Direct Transfers' && <td className="px-2 py-2 text-[11px] text-gray-600">{row.to_event ?? '—'}</td>}
                        <td className="px-2 py-2 text-[11px] text-gray-600">{row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 5d. Photos */}
      <Section title="Photos">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PHOTO_CATEGORIES.map((cat) => {
            const items = data.photos.filter((p) => p.category === cat.key)
            return (
              <div key={cat.key} className="rounded-lg border border-gray-100 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                  <h4 className="flex items-center gap-1 text-xs font-bold text-gray-900"><ImageIcon size={12} /> {cat.label}</h4>
                  {canEdit && (
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

      {/* 5e. Event Timeline */}
      <Section title="Event Timeline">
        <ol className="space-y-0">
          {data.timeline.map((stage, idx) => (
            <li key={stage.key} className="relative flex gap-3 pb-5">
              {idx < data.timeline.length - 1 && <span className="absolute left-[9px] top-5 h-full w-px bg-gray-200" />}
              <span className={`mt-0.5 h-[19px] w-[19px] shrink-0 rounded-full border-2 ${
                stage.status === 'completed' ? 'border-emerald-500 bg-emerald-500'
                : stage.status === 'active' ? 'border-blue-500 bg-white'
                : 'border-gray-300 bg-white'
              }`}>
                {stage.status === 'completed' && <CheckCircle2 size={14} className="text-white" />}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900">
                  {stage.label}{' '}
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                    stage.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                    : stage.status === 'active' ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                  }`}>{stage.status}</span>
                </p>
                {stage.description && <p className="mt-0.5 text-[11px] text-gray-500">{stage.description}</p>}
                {stage.date && <p className="mt-0.5 text-[10px] text-gray-400">{new Date(stage.date).toLocaleString('en-IN')}</p>}
              </div>
            </li>
          ))}
        </ol>
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
            ['Wastage Qty', data.closure.wastage_qty],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-100 bg-cream p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 7. Upload History */}
      <Section title="Upload History">
        {data.upload_history.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No inventory movement uploads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Version', 'Movement Type', 'File Name', 'Uploaded At', 'Uploaded By', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.upload_history.map((v) => (
                  <tr key={v.id} className="border-b border-gray-50">
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-900">V{v.version_no}</td>
                    <td className="px-3 py-2.5 text-xs capitalize text-gray-700">{v.movement_type}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{v.file_name}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{v.uploaded_at ? new Date(v.uploaded_at).toLocaleString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{v.uploaded_by_name ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => downloadUploadVersion(id, v.id, v.file_name)}
                        title={`Download ${v.file_name}`}
                        aria-label={`Download ${v.file_name}`}
                        className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] font-medium hover:bg-gray-50"
                      >
                        <Download size={11} /> Download
                      </button>
                    </td>
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
