import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, deleteUser } from '@/api/users'
import PageHeader from '@/components/common/PageHeader'
import { ROLE_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Search } from 'lucide-react'

export default function UserManagement() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role_id: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => getUsers({ search, per_page: 50 }),
  })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created')
      setShowCreate(false)
      setForm({ email: '', password: '', full_name: '', role_id: '' })
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create user'
      toast.error(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deactivated')
    },
  })

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

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">New User</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
              placeholder="Password"
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
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending}
                className="flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-white transition-colors hover:bg-gold-hover"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
                    <button
                      onClick={() => deleteMutation.mutate(user.id)}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
