import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  X,
  Eye,
  Download,
  Upload,
  FileText,
  FileSpreadsheet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  Flame,
} from 'lucide-react'
import type { Inquiry } from '@/types/inquiry'
import type { InventoryMovement, InventoryMovementType } from '@/types/inventory'
import type { InquiryFileType } from '@/api/inquiries'
import {
  getInquiry,
  getInventoryMovements,
  uploadInventoryMovementFile,
  viewInquiryFile,
  downloadInquiryFile,
} from '@/api/inquiries'
import ExcelPreviewModal from '@/components/inventory/ExcelPreviewModal'
import { getErrorMessage } from '@/lib/apiError'

const MOVEMENT_ORDER: InventoryMovementType[] = ['received', 'returned', 'transferred', 'wastage']

type InquiryFileNameKey = { [K in keyof Inquiry]-?: Inquiry[K] extends string | null ? K : never }[keyof Inquiry]

const MOVEMENT_META: Record<InventoryMovementType, {
  label: string
  chip: string
  badge: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  fileType: InquiryFileType
  fileNameKey: InquiryFileNameKey
}> = {
  received: { label: 'Received', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: ArrowDownToLine, fileType: 'inventory', fileNameKey: 'inventory_file_name' },
  returned: { label: 'Returned', chip: 'bg-blue-50 text-blue-700 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: ArrowUpFromLine, fileType: 'returned', fileNameKey: 'returned_file_name' },
  transferred: { label: 'Transferred', chip: 'bg-amber-50 text-amber-700 border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: ArrowRightLeft, fileType: 'transferred', fileNameKey: 'transferred_file_name' },
  wastage: { label: 'Wastage', chip: 'bg-red-50 text-red-700 border-red-200', badge: 'bg-red-100 text-red-700', icon: Flame, fileType: 'wastage', fileNameKey: 'wastage_file_name' },
}

export default function InventoryPanelModal({
  inquiry,
  isOpen,
  onClose,
}: {
  inquiry: Inquiry | null
  isOpen: boolean
  onClose: () => void
}) {
  const id = inquiry?.id ?? ''
  const queryClient = useQueryClient()
  const [uploadingType, setUploadingType] = useState<InventoryMovementType | null>(null)
  const [viewMenuText, setViewMenuText] = useState(false)
  const [preview, setPreview] = useState<{ fileType: InquiryFileType; fileName: string } | null>(null)

  const { data: detail } = useQuery({
    queryKey: ['inquiry-detail', id],
    queryFn: () => getInquiry(id),
    enabled: isOpen && Boolean(id),
  })
  const data = detail ?? inquiry

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['inventory-movements', id],
    queryFn: () => getInventoryMovements(id),
    enabled: isOpen && Boolean(id),
  })

  const handleFileUpload = async (movementType: InventoryMovementType, file?: File) => {
    if (!file) return
    setUploadingType(movementType)
    try {
      const res = await uploadInventoryMovementFile(id, movementType, file)
      toast.success(`${MOVEMENT_META[movementType].label}: ${res.entries_created} entries added`)
      queryClient.invalidateQueries({ queryKey: ['inventory-movements', id] })
      queryClient.invalidateQueries({ queryKey: ['inquiry-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'))
    } finally {
      setUploadingType(null)
    }
  }

  const downloadMenuText = () => {
    const token = localStorage.getItem('access_token')
    fetch(`/api/inquiries/${id}/menu/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => { if (!res.ok) throw new Error(); return res.blob() })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Menu_${data?.client_name.replace(/\s+/g, '_') ?? 'event'}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Failed to download menu'))
  }

  const openMenuView = () => {
    if (data?.menu_file_name) viewInquiryFile(id, 'menu')
    else if (data?.menu_content) setViewMenuText(true)
    else toast.error('No menu uploaded yet')
  }

  const hasMenu = Boolean(data?.menu_file_name || data?.menu_content)
  const hasIngredient = Boolean(data?.ingredient_file_name)
  const totals = MOVEMENT_ORDER.map((t) => ({ type: t, total: movements.filter((m) => m.movement_type === t).reduce((s, m) => s + m.quantity, 0) }))

  return (
    <AnimatePresence>
      {isOpen && inquiry && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">{inquiry.client_name} — Inventory Panel</h3>
                <p className="text-[11px] text-gray-500">
                  {inquiry.event_type ?? '—'} · {inquiry.event_date ?? '—'} · Pax {inquiry.pax ?? '—'}
                </p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {/* Documents */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Documents</p>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-emerald-500" />
                      <span className="text-xs font-semibold text-gray-900">Menu</span>
                      {hasMenu ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Ready</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={openMenuView} disabled={!hasMenu}
                        className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-medium hover:bg-gray-50 disabled:opacity-40">
                        <Eye size={12} /> View
                      </button>
                      <button
                        onClick={() => data?.menu_file_name ? downloadInquiryFile(id, 'menu', data.menu_file_name) : data?.menu_content ? downloadMenuText() : undefined}
                        disabled={!hasMenu}
                        className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-medium hover:bg-gray-50 disabled:opacity-40">
                        <Download size={12} /> Download
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={14} className="text-amber-500" />
                      <span className="text-xs font-semibold text-gray-900">Ingredient Excel (from kitchen)</span>
                      {hasIngredient ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Ready</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => hasIngredient && setPreview({ fileType: 'ingredient', fileName: data?.ingredient_file_name ?? '' })} disabled={!hasIngredient}
                        className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-medium hover:bg-gray-50 disabled:opacity-40">
                        <Eye size={12} /> View
                      </button>
                      <button
                        onClick={() => hasIngredient && downloadInquiryFile(id, 'ingredient', data?.ingredient_file_name)}
                        disabled={!hasIngredient}
                        className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-medium hover:bg-gray-50 disabled:opacity-40">
                        <Download size={12} /> Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock Register */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Stock Register — upload an excel for each category to auto-fill entries
                </p>

                {/* Category table */}
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Category</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Total</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">File</th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOVEMENT_ORDER.map((type) => {
                        const meta = MOVEMENT_META[type]
                        const Icon = meta.icon
                        const fileName = data?.[meta.fileNameKey] ?? null
                        const total = totals.find((t) => t.type === type)?.total ?? 0
                        return (
                          <tr key={type} className="border-b border-gray-50 last:border-0">
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-md ${meta.badge}`}>
                                  <Icon size={12} />
                                </span>
                                <span className="text-xs font-semibold text-gray-900">{meta.label}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-sm font-bold tabular-nums text-gray-900">{total}</td>
                            <td className="max-w-[160px] truncate px-3 py-2.5 text-[11px] text-gray-500" title={fileName ?? ''}>
                              {fileName ?? '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-1.5">
                                <label
                                  className="flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                  title={`Upload ${meta.label} excel (.xlsx or .csv)`}>
                                  {uploadingType === type ? (
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                                  ) : (
                                    <Upload size={12} />
                                  )}
                                  <span>Upload</span>
                                  <input type="file" className="hidden" accept=".xlsx,.csv"
                                    onChange={(e) => { handleFileUpload(type, e.target.files?.[0]); e.target.value = '' }} />
                                </label>
                                <button onClick={() => fileName && setPreview({ fileType: meta.fileType, fileName })} disabled={!fileName}
                                  className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-medium hover:bg-gray-50 disabled:opacity-40">
                                  <Eye size={12} /> View
                                </button>
                                <button onClick={() => fileName && downloadInquiryFile(id, meta.fileType, fileName)} disabled={!fileName}
                                  className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-medium hover:bg-gray-50 disabled:opacity-40">
                                  <Download size={12} /> Download
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Entries list */}
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Entries ({movements.length})</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {isLoading ? (
                      <p className="px-3 py-6 text-center text-xs text-gray-400">Loading entries...</p>
                    ) : movements.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-gray-400">No stock entries yet. Upload an excel to auto-fill entries.</p>
                    ) : (
                      movements.map((m: InventoryMovement) => {
                        const meta = MOVEMENT_META[m.movement_type]
                        return (
                          <div key={m.id} className="flex items-center gap-2 border-b border-gray-50 px-3 py-2 last:border-0">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>{meta.label}</span>
                            <span className="text-xs font-medium text-gray-900">{m.item_name}</span>
                            <span className="text-xs text-gray-500">{m.quantity} {m.unit ?? ''}</span>
                            {m.notes && <span className="max-w-[140px] truncate text-[11px] text-gray-400" title={m.notes}>— {m.notes}</span>}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Menu text viewer */}
      {viewMenuText && data?.menu_content && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setViewMenuText(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Menu — {data.client_name}</h3>
              <button onClick={() => setViewMenuText(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-4 text-xs text-gray-700">
              {data.menu_content}
            </pre>
          </motion.div>
        </motion.div>
      )}

      {/* Excel preview */}
      {preview && (
        <ExcelPreviewModal
          inquiryId={id}
          fileType={preview.fileType}
          fileName={preview.fileName}
          onClose={() => setPreview(null)}
        />
      )}
    </AnimatePresence>
  )
}
