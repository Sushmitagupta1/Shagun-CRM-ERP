import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import { Bell, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getNotificationsForRole } from '@/lib/notifications'
import type { Notification } from '@/lib/notifications'

const filterOptions = ['All', 'Unread', 'Payments', 'Inquiries', 'Events']

export default function NotificationsPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState('All')

  const notifications = useMemo(() => getNotificationsForRole(user?.role.name), [user?.role.name])
  const unreadCount = notifications.filter((n) => !n.read).length

  const filtered = notifications.filter((n) => {
    if (filter === 'All') return true
    if (filter === 'Unread') return !n.read
    if (filter === 'Payments') return ['payment', 'settlement'].includes(n.type)
    if (filter === 'Inquiries') return ['inquiry', 'status', 'menu', 'followup'].includes(n.type)
    if (filter === 'Events') return ['event', 'kitchen', 'warehouse', 'meeting', 'vendor'].includes(n.type)
    return true
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        action={
          <button className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50">
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
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Bell size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-400">No notifications found</p>
            </div>
          ) : (
            filtered.map((notif, i) => (
              <NotificationRow key={notif.id} notif={notif} index={i} />
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}

function NotificationRow({ notif, index }: { notif: Notification; index: number }) {
  const Icon = notif.icon
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-gray-50 ${
        !notif.read ? 'bg-blue-50/30' : ''
      }`}
    >
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${notif.color}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
            {notif.title}
          </p>
          {!notif.read && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{notif.detail}</p>
        <p className="mt-1 text-[10px] text-gray-400">{notif.time}</p>
      </div>
    </motion.div>
  )
}
