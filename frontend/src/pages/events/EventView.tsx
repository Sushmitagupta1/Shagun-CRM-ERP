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
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useEventDetail, useSaveInventoryItems, useSaveVendors, useCompleteEvent } from '@/hooks/useEvents'
import { downloadInquiryFile, uploadInquiryFile } from '@/api/inquiries'
import { downloadUploadVersion } from '@/api/events'
import type { EventInventoryRow, EventVendorRow } from '@/types/event'
import { getErrorMessage } from '@/lib/apiError'
import { INQUIRY_STATUSES } from '@/lib/constants'

const EDITABLE_ROLES = ['operations_manager', 'admin', 'warehouse']
const KITCHEN_UPLOAD_ROLES = ['kitchen', 'admin']
const VENDOR_UPLOAD_ROLES = ['operations_manager', 'admin', 'warehouse']

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

export default function EventView() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role?.name ?? ''
  const { data, isLoading, refetch } = useEventDetail(id)
  const saveItems = useSaveInventoryItems(id)
  const saveVendors = useSaveVendors(id)
  const complete = useCompleteEvent(id)

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
      const changed = orig && (v.rate !== orig.rate || v.total_cost !== orig.total_cost)
      return { id: v.id, rate: changed ? v.rate : null, total_cost: changed ? v.total_cost : null, remark: v.remark }
    })
    const missing = payload.filter((p) => (p.rate !== null || p.total_cost !== null) && !(p.remark || '').trim())
    if (missing.length > 0) {
      toast.error('Remark is mandatory when changing vendor rate/cost')
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

      {/* 2. Documents — Menu only */}
      <Section title="Documents — Menu">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-emerald-500" />
            <span className="text-xs font-semibold text-gray-900">Menu</span>
            {data.menu.uploaded ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Ready</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => data.menu.file_name && downloadInquiryFile(id, 'menu', data.menu.file_name)}
              disabled={!data.menu.uploaded}
              className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              <Download size={12} /> Download
            </button>
          </div>
        </div>
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
                {['Sr No', 'Vendor Name', 'Service Name', 'Rate (₹)', 'Total Cost (₹)', 'Remark'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorRows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-gray-400">No vendors yet — upload a Vendor Excel.</td></tr>
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
