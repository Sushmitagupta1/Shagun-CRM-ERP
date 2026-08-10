import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getRoles, createUser, updateUser, deleteUser } from '@/api/users'
import PageHeader from '@/components/common/PageHeader'
import { ROLE_LABELS } from '@/lib/constants'
import { getErrorMessage } from '@/lib/apiError'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Loader2, Search, X } from 'lucide-react'
import type { User } from '@/types/auth'

const EMPTY_FORM = { username: '', email: '', password: '', full_name: '', role_id: '' }

export default function UserManagement() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => getUsers({ search, per_page: 50 }),
  })

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created')
      setShowCreate(false)
      setForm(EMPTY_FORM)
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, 'Failed to create user'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof EMPTY_FORM> }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
      setEditing(null)
      setForm(EMPTY_FORM)
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, 'Failed to update user'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deactivated')
    },
  })

  const startEdit = (user: User) => {
    setEditing(user)
    setForm({
      username: '',
      email: user.email,
      password: '',
      full_name: user.full_name,
      role_id: user.role.id,
    })
  }

  const handleSave = () => {
    if (editing) {
      const data: Partial<typeof EMPTY_FORM> = {
        username: form.username || undefined,
        email: form.email,
        full_name: form.full_name,
        role_id: form.role_id,
        password: form.password || undefined,
      }
      updateMutation.mutate({ id: editing.id, data })
    } else {
      if (!form.email || !form.password || !form.full_name || !form.role_id) {
        toast.error('Email, Password, Name and Role are required')
        return
      }
      createMutation.mutate(form)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        action={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-white shadow transition-colors hover:bg-gold-hover"
          >
            <Plus className="h-4 w-4" /> Add User
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="h-9 w-full rounded-lg border border-gray-200 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
      </div>

      {/* Create/Edit Form */}
      {(showCreate || editing) && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {editing ? `Edit User — ${editing.full_name}` : 'New User'}
            </h3>
            <button
              onClick={() => { setEditing(null); setShowCreate(false); setForm(EMPTY_FORM) }}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <input
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
            />
            <input
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
            />
            <input
              placeholder={editing ? 'New password (optional)' : 'Password'}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm"
              >
                <option value="">Select Role</option>
                {roles?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {ROLE_LABELS[role.name] || role.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-white transition-colors hover:bg-gold-hover"
              >
                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Email
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-gold" />
                </td>
              </tr>
            ) : (
              data?.items?.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                    {user.full_name}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{user.email}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">
                    {ROLE_LABELS[user.role?.name] || user.role?.name}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        user.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(user)}
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(user.id)}
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
