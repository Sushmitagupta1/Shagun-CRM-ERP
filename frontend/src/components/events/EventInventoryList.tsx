import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Package, Eye } from 'lucide-react'
import { useEvents, useEventDetail } from '@/hooks/useEvents'

function EventInventoryTable({ eventId }: { eventId: string }) {
  const { data } = useEventDetail(eventId)
  if (!data) return <p className="px-4 py-4 text-center text-[11px] text-gray-400">Loading…</p>
  if (data.inventory.length === 0) return <p className="px-4 py-4 text-center text-[11px] text-gray-400">No inventory yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {['Item', 'Required', 'Received', 'Not Received', 'Status'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.inventory.map((r) => (
            <tr key={r.item_name} className="border-b border-gray-50">
              <td className="px-3 py-2 text-[11px] font-medium text-gray-900">{r.item_name}</td>
              <td className="px-3 py-2 text-[11px] tabular-nums text-gray-700">{r.required_qty} {r.unit ?? ''}</td>
              <td className="px-3 py-2 text-[11px] tabular-nums text-gray-700">{r.received_qty}</td>
              <td className="px-3 py-2 text-[11px] tabular-nums text-gray-700">{r.not_received_count}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  r.received_tag === 'Yes' ? 'bg-emerald-100 text-emerald-700'
                  : r.received_tag === 'Half' ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
                }`}>{r.received_tag}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function EventInventoryList() {
  const { data: events, isLoading } = useEvents()
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.45 }}
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Package size={14} className="text-emerald-500" /> Event Inventory <span className="text-[10px] font-medium text-gray-400">(view only)</span>
        </h3>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{events?.length ?? 0} events</span>
      </div>
      {isLoading ? (
        <p className="py-6 text-center text-xs text-gray-400">Loading events…</p>
      ) : !events || events.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">No handover events yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => {
            const open = openId === ev.id
            return (
              <div key={ev.id} className="rounded-lg border border-gray-100">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : ev.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                >
                  {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                  <span className="flex-1 text-xs font-semibold text-gray-900">{ev.client_name}</span>
                  <span className="text-[10px] text-gray-400">{ev.event_type} · {ev.event_date ?? 'no date'}</span>
                  {ev.is_completed && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Done</span>}
                  <Eye size={13} className="pointer-events-none text-gray-300" aria-hidden="true" />
                </button>
                {open && <div className="border-t border-gray-100"><EventInventoryTable eventId={ev.id} /></div>}
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
