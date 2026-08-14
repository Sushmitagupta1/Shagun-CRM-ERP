import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Save } from 'lucide-react'
import type { WordLine } from '@/lib/menuDesign'

export default function WordMenuEditor({ lines, onClose, onSave }: {
  lines: WordLine[]
  onClose: () => void
  onSave: (lines: WordLine[]) => void
}) {
  const [draft, setDraft] = useState<WordLine[]>(lines.map((l) => ({ ...l })))

  const update = (index: number, text: string) => {
    setDraft((prev) => prev.map((l, i) => (i === index ? { ...l, text } : l)))
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="mt-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Edit Word Menu</h3>
            <p className="text-[11px] text-gray-400">Text edits only — categories and layout from the Word file are kept.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto bg-gray-50 p-5">
          {draft.map((l, i) => (
            <input
              key={i}
              value={l.text}
              onChange={(e) => update(i, e.target.value)}
              className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gold/30 ${l.is_heading ? 'font-bold uppercase' : ''}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose}
            className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onSave(draft)}
            className="flex h-9 items-center gap-2 rounded-lg bg-maroon px-4 text-xs font-bold text-white transition-colors hover:bg-maroon-dark">
            <Save size={13} /> Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
