import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import { Bell, CheckCircle2, Calendar, FileText, ChefHat, Presentation, Truck, Package, Wallet, Clock, Users, Settings } from 'lucide-react'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/api/notifications'
import type { AppNotification } from '@/api/notifications'
import type { ComponentType } from 'react'

const filterOptions = ['All', 'Unread', 'Payments', 'Inquiries', 'Events']

const typeStyles: Record<string, { icon: ComponentType<{ size?: number; className?: string }>; color: string }> = {
  event: { icon: Calendar, color: 'bg-indigo-100 text-indigo-600' },
  inquiry: { icon: FileText, color: 'bg-blue-100 text-blue-600' },
  status: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  followup: { icon: Clock, color: 'bg-amber-100 text-amber-600' },
  menu: { icon: ChefHat, color: 'bg-purple-100 text-purple-600' },
  presentation: { icon: Presentation, color: 'bg-indigo-100 text-indigo-600' },
  theme: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  meeting: { icon: Calendar, color: 'bg-blue-100 text-blue-600' },
  payment: { icon: Wallet, color: 'bg-emerald-100 text-emerald-600' },
  settlement: { icon: Wallet, color: 'bg-rose-100 text-rose-600' },
  kitchen: { icon: ChefHat, color: 'bg-amber-100 text-amber-600' },
  warehouse: { icon: Package, color: 'bg-rose-100 text-rose-600' },
  vendor: { icon: Truck, color: 'bg-amber-100 text-amber-600' },
  user: { icon: Users, color: 'bg-blue-100 text-blue-600' },
  setting: { icon: Settings, color: 'bg-gray-100 text-gray-600' },
}

const defaultStyle = { icon: Bell, color: 'bg-gray-100 text-gray-600' }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString()
}

function matchesFilter(n: AppNotification, filter: string) {
  if (filter === 'All') return true
  if (filter === 'Unread') return !n.is_read
  if (filter === 'Payments') return ['payment', 'settlement'].includes(n.type)
  if (filter === 'Inquiries') return ['inquiry', 'status', 'menu', 'followup'].includes(n.type)
  if (filter === 'Events') return ['event', 'kitchen', 'warehouse', 'meeting', 'vendor'].includes(n.type)
  return true
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('All')

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications({ per_page: 50 }),
  })

  const notifications = data?.items ?? []
  const unreadCount = notifications.filter((n) => !n.is_read).length
  const filtered = notifications.filter((n) => matchesFilter(n, filter))

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        action={
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={unreadCount === 0 || markAllMutation.isPending}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> Mark all read
          </button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-maroon text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'Unread' && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
            {f}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md"
      >
        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Bell size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-400">No notifications found</p>
            </div>
          ) : (
            filtered.map((notif, i) => (
              <NotificationRow key={notif.id} notif={notif} index={i} onRead={() => markReadMutation.mutate(notif.id)} />
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}

function NotificationRow({ notif, index, onRead }: { notif: AppNotification; index: number; onRead: () => void }) {
  const style = typeStyles[notif.type] ?? defaultStyle
  const Icon = style.icon
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => { if (!notif.is_read) onRead() }}
      className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-gray-50 ${!notif.is_read ? 'bg-blue-50/30 cursor-pointer' : ''}`}
    >
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.color}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
            {notif.title}
          </p>
          {!notif.is_read && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{notif.message}</p>
        <p className="mt-1 text-[10px] text-gray-400">{timeAgo(notif.created_at)}</p>
      </div>
    </motion.div>
  )
}
