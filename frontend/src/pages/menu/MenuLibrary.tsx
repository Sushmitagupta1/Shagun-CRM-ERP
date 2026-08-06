import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMenuTemplates, updateMenuTemplate } from '@/api/menu'
import type { MenuTemplate } from '@/api/menu'
import PageHeader from '@/components/common/PageHeader'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { FileText, X, Save, ChevronRight } from 'lucide-react'

export default function MenuLibrary() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<MenuTemplate>>({})

  const { data: templates, isLoading } = useQuery({
    queryKey: ['menu-templates'],
    queryFn: getMenuTemplates,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MenuTemplate> }) =>
      updateMenuTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-templates'] })
      toast.success('Menu template updated')
      setEditingId(null)
    },
    onError: () => toast.error('Failed to update'),
  })

  const startEdit = (tpl: MenuTemplate) => {
    setEditingId(tpl.id)
    setEditForm({ ...tpl })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = () => {
    if (!editingId) return
    updateMutation.mutate({ id: editingId, data: editForm })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Menu Library" subtitle="View and customize menu templates" />

      <div className="grid gap-4 lg:grid-cols-2">
        {templates?.map((tpl, i) => (
          <motion.div
            key={tpl.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md"
          >
            {editingId === tpl.id ? (
              /* Edit Mode */
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">Edit Template</h3>
                  <button onClick={cancelEdit} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Name</label>
                    <input
                      value={editForm.name ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Category</label>
                    <input
                      value={editForm.category ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Description</label>
                    <textarea
                      value={editForm.description ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="h-20 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Dish Count</label>
                      <input
                        type="number"
                        value={editForm.dish_count ?? 0}
                        onChange={(e) => setEditForm({ ...editForm, dish_count: parseInt(e.target.value) || 0 })}
                        className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Gradient</label>
                      <input
                        value={editForm.gradient ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, gradient: e.target.value })}
                        className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Dishes (comma separated)</label>
                    <textarea
                      value={Array.isArray(editForm.dishes?.items) ? (editForm.dishes.items as string[]).join(', ') : typeof editForm.dishes === 'string' ? editForm.dishes : ''}
                      onChange={(e) => setEditForm({ ...editForm, dishes: { items: e.target.value.split(',').map((d) => d.trim()).filter(Boolean) } })}
                      className="h-16 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                  </div>
                  <button
                    onClick={saveEdit}
                    disabled={updateMutation.isPending}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-maroon text-sm font-bold text-white transition-colors hover:bg-maroon-dark disabled:opacity-50"
                  >
                    <Save size={14} /> {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <>
                <div className={`h-2 bg-gradient-to-r ${tpl.gradient}`} />
                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{tpl.name}</h3>
                      <p className="text-[11px] text-gray-400">{tpl.category} &middot; {tpl.dish_count} dishes</p>
                    </div>
                    <button
                      onClick={() => startEdit(tpl)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  </div>
                  {tpl.description && (
                    <p className="mb-3 text-xs text-gray-500">{tpl.description}</p>
                  )}
                  {Array.isArray(tpl.dishes?.items) && (tpl.dishes.items as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(tpl.dishes.items as string[]).map((dish, di) => (
                        <span key={di} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-600">
                          {dish}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-gold">
                    <FileText size={12} /> View full menu
                    <ChevronRight size={12} />
                  </div>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
