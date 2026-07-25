import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Search, LogOut, Calendar, Clock, ChevronRight, X, Activity, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_LABELS } from '@/lib/constants'
import { getNotificationsForRole } from '@/lib/notifications'
import { useNavigate } from 'react-router-dom'
import { useSidebarStore } from '@/store/sidebarStore'

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function TopNav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { toggle } = useSidebarStore()
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [notifTab, setNotifTab] = useState<'events' | 'followups' | 'activity'>('events')
  const panelRef = useRef<HTMLDivElement>(null)

  const roleNotifs = useMemo(() => getNotificationsForRole(user?.role.name), [user?.role.name])
  const unreadCount = roleNotifs.filter((n) => !n.read).length

  const roleEvents = roleNotifs.filter((n) => ['event', 'meeting', 'kitchen', 'warehouse', 'vendor'].includes(n.type))
  const roleFollowups = roleNotifs.filter((n) => ['followup', 'inquiry', 'status', 'menu'].includes(n.type))
  const roleActivity = roleNotifs.filter((n) => ['payment', 'settlement', 'presentation', 'theme', 'user', 'setting'].includes(n.type))

  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfMonth(calYear, calMonth)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  const highlightDay = today.getDate()

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white/80 px-4 backdrop-blur-md sm:h-16 sm:px-6"
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div className="relative hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-full max-w-[200px] rounded-full border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm text-gray-700 outline-none transition-all duration-200 focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20 lg:w-72"
          />
        </div>
        {/* Mobile search icon */}
        <button className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 sm:hidden">
          <Search size={18} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Calendar Quick View */}
        <div className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 xl:flex">
          <Calendar size={14} className="text-maroon" />
          <span className="font-medium">{today.getDate()} {monthNames[today.getMonth()].slice(0, 3)}</span>
          <span className="text-gray-400">·</span>
          <span>{roleEvents.length} events today</span>
        </div>

        {/* Bell Notification */}
        <div className="relative" ref={panelRef}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {showNotifPanel && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl"
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  <button onClick={() => setShowNotifPanel(false)} className="rounded p-1 hover:bg-gray-100">
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-4">
                  {[
                    { key: 'events' as const, label: 'Events' },
                    { key: 'followups' as const, label: 'Follow-ups' },
                    { key: 'activity' as const, label: 'Activity' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setNotifTab(tab.key)}
                      className={`relative px-3 py-2.5 text-xs font-medium transition-colors ${
                        notifTab === tab.key ? 'text-maroon' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                      {notifTab === tab.key && (
                        <motion.div
                          layoutId="notif-tab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-maroon"
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Events Tab */}
                {notifTab === 'events' && (
                  <div className="max-h-72 overflow-y-auto">
                    {/* Mini Calendar */}
                    <div className="border-b border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => {
                            if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) }
                            else setCalMonth(calMonth - 1)
                          }}
                          className="rounded p-1 hover:bg-gray-100 text-xs text-gray-500"
                        >
                          ‹
                        </button>
                        <span className="text-xs font-semibold text-gray-900">
                          {monthNames[calMonth]} {calYear}
                        </span>
                        <button
                          onClick={() => {
                            if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) }
                            else setCalMonth(calMonth + 1)
                          }}
                          className="rounded p-1 hover:bg-gray-100 text-xs text-gray-500"
                        >
                          ›
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-0.5">
                        {dayNames.map((d) => (
                          <div key={d} className="py-1 text-center text-[9px] font-medium text-gray-400">{d}</div>
                        ))}
                        {Array.from({ length: firstDay }).map((_, i) => (
                          <div key={`empty-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1
                          const isToday = day === highlightDay && calMonth === today.getMonth() && calYear === today.getFullYear()
                          return (
                            <div
                              key={day}
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                                isToday
                                  ? 'bg-maroon font-bold text-white'
                                  : 'text-gray-600'
                              }`}
                            >
                              {day}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Role-specific events */}
                    <div className="px-4 py-2">
                      {roleEvents.length === 0 ? (
                        <p className="py-4 text-center text-xs text-gray-400">No events for your role</p>
                      ) : (
                        roleEvents.map((n) => (
                          <div key={n.id} className={`mb-1 flex items-center gap-2 rounded-lg px-3 py-2 ${n.read ? 'bg-gray-50' : 'bg-blue-50'}`}>
                            <Clock size={12} className="text-blue-500" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-900 truncate">{n.title}</p>
                              <p className="text-[10px] text-gray-500">{n.detail}</p>
                            </div>
                            <span className="shrink-0 text-[10px] text-gray-400">{n.time}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Follow-ups Tab */}
                {notifTab === 'followups' && (
                  <div className="max-h-72 overflow-y-auto px-4 py-3">
                    {roleFollowups.length === 0 ? (
                      <p className="py-4 text-center text-xs text-gray-400">No follow-ups for your role</p>
                    ) : (
                      roleFollowups.map((n) => (
                        <div key={n.id} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-100 ${n.read ? 'bg-gray-50' : 'bg-blue-50/30'}`}>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100">
                            <n.icon size={14} className="text-purple-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-900">{n.title}</p>
                            <p className="text-[10px] text-gray-500">{n.detail}</p>
                          </div>
                          <span className="shrink-0 text-[10px] text-gray-400">{n.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Activity Tab */}
                {notifTab === 'activity' && (
                  <div className="max-h-72 overflow-y-auto px-4 py-3">
                    {roleActivity.length === 0 ? (
                      <p className="py-4 text-center text-xs text-gray-400">No recent activity for your role</p>
                    ) : (
                      roleActivity.map((n) => (
                        <div key={n.id} className={`mb-1 flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50 ${n.read ? '' : 'bg-blue-50/30'}`}>
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                            <Activity size={11} className="text-emerald-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-900">{n.title}</p>
                            <p className="text-[10px] text-gray-500">{n.detail}</p>
                          </div>
                          <span className="shrink-0 text-[10px] text-gray-400">{n.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* View All */}
                <div className="border-t border-gray-100 px-4 py-2.5">
                  <button
                    onClick={() => { setShowNotifPanel(false); navigate('/notifications') }}
                    className="flex w-full items-center justify-center gap-1 text-xs font-medium text-maroon hover:underline"
                  >
                    View all notifications <ChevronRight size={12} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex h-8 w-8 cursor-default items-center justify-center rounded-full bg-maroon text-xs font-semibold text-white shadow-sm"
          >
            {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
          </motion.div>
          <div className="hidden text-sm md:block">
            <p className="font-medium text-gray-900">{user?.full_name}</p>
            <p className="text-xs text-gray-500">
              {ROLE_LABELS[user?.role.name ?? ''] ?? user?.role.name}
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title="Sign out"
        >
          <LogOut size={18} />
        </motion.button>
      </div>
    </motion.header>
  )
}
