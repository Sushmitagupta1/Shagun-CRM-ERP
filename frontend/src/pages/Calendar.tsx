import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { getCalendarData, getInquiries } from '@/api/inquiries'
import type { Inquiry } from '@/types/inquiry'
import { INQUIRY_STATUSES } from '@/lib/constants'
import { ChevronLeft, ChevronRight, Users, ExternalLink, Calendar as CalendarIcon, CheckCircle2, Clock } from 'lucide-react'

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const dayShort = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const CONFIRMED_STATUSES = ['client_confirmation', 'advance_receive', 'operation_handover']

const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function CalendarPage() {
  const today = new Date()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isMenuPlanner = user?.role.name === 'menu_planner'
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(today))

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
  const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-data', currentYear, currentMonth],
    queryFn: () => getCalendarData(monthStart, monthEnd),
  })

  const events: Inquiry[] = (data?.events ?? []).filter((i) => i.status !== 'cancelled')
  const followups = isMenuPlanner ? [] : (data?.followups ?? [])
  const meetings = isMenuPlanner ? [] : (data?.meetings ?? [])

  const upTo = new Date(today)
  upTo.setDate(upTo.getDate() + 90)
  const upStart = toDateStr(today)
  const upEnd = toDateStr(upTo)

  const { data: upcomingData } = useQuery({
    queryKey: ['upcoming-events', upStart, upEnd],
    queryFn: () => getInquiries({ per_page: 100, event_date_from: upStart, event_date_to: upEnd }),
  })

  const upcomingEvents: Inquiry[] = (upcomingData?.items ?? [])
    .filter((i) => i.status !== 'cancelled')
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))
    .slice(0, 10)

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) }
    else setCurrentMonth(currentMonth - 1)
  }

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) }
    else setCurrentMonth(currentMonth + 1)
  }

  const goToToday = () => {
    setCurrentMonth(today.getMonth())
    setCurrentYear(today.getFullYear())
    setSelectedDate(toDateStr(today))
  }

  const getDayItems = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return {
      events: events.filter((e) => e.event_date === dateStr),
      followups: followups.filter((f) => f.follow_up_date === dateStr),
      meetings: meetings.filter((m) => toDateStr(new Date(m.meeting_at)) === dateStr),
    }
  }

  const selectedItems = (() => {
    const parts = selectedDate.split('-')
    return getDayItems(parseInt(parts[2]))
  })()

  const selectedCount = selectedItems.events.length + selectedItems.followups.length + selectedItems.meetings.length

  const isToday = (day: number) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
  }

  const isConfirmed = (event: Inquiry) => CONFIRMED_STATUSES.includes(event.status)

  const formatMeetingTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="Events, follow-ups & meetings by date"
        action={
          <button
            onClick={goToToday}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50"
          >
            Today
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Calendar Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md xl:col-span-2"
        >
          {/* Month Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-gray-100">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <h3 className="text-sm font-semibold text-gray-900">
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-gray-100">
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {dayShort.map((d) => (
              <div key={d} className="py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24 border-b border-r border-gray-50 bg-gray-50/30" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayItems = getDayItems(day)
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSelected = dateStr === selectedDate
              const todayFlag = isToday(day)

              const cells = [
                ...dayItems.meetings.map((m) => ({ key: `m-${m.id}`, cls: 'bg-blue-100 text-blue-700', label: `MTG · ${m.client_name}` })),
                ...dayItems.followups.map((f) => ({ key: `f-${f.id}`, cls: 'bg-gold/15 text-amber-900', label: `FU · ${f.client_name}` })),
                ...dayItems.events.map((e) => ({ key: `e-${e.id}`, cls: isConfirmed(e) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700', label: e.client_name })),
              ]

              return (
                <motion.div
                  key={day}
                  whileHover={{ backgroundColor: 'rgba(250, 250, 247, 1)' }}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`relative h-24 cursor-pointer border-b border-r border-gray-50 p-1.5 transition-colors ${
                    isSelected ? 'bg-gold/5 ring-1 ring-inset ring-gold/30' : ''
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      todayFlag
                        ? 'bg-maroon text-white font-bold'
                        : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {cells.slice(0, 2).map((c) => (
                      <div key={c.key} className={`truncate rounded px-1 py-0.5 text-[9px] font-medium ${c.cls}`}>
                        {c.label}
                      </div>
                    ))}
                    {cells.length > 2 && (
                      <span className="text-[9px] text-gray-400">+{cells.length - 2} more</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Selected Date Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex rounded-xl border border-gray-100 bg-white shadow-md"
          style={{ height: 660, flexDirection: 'column' }}
        >
          <div className="shrink-0 border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <p className="text-xs text-gray-500">
              {isLoading ? 'Loading…' : `${selectedCount} item${selectedCount !== 1 ? 's' : ''} scheduled`}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
              </div>
            ) : selectedCount === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">Nothing scheduled on this date</p>
              </div>
            ) : (
              <>
                {selectedItems.meetings.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg border border-blue-100 p-4 transition-colors hover:border-blue-200"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-blue-600" />
                          <p className="text-sm font-semibold text-gray-900">{m.client_name}</p>
                        </div>
                        <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          Meeting · {formatMeetingTime(m.meeting_at)}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate(`/inquiries/${m.inquiry_id}`)}
                        className="flex items-center gap-1 text-[10px] font-medium text-maroon hover:underline"
                      >
                        <ExternalLink size={11} /> View
                      </button>
                    </div>
                    {m.remarks && <p className="text-xs text-gray-500">{m.remarks}</p>}
                  </motion.div>
                ))}

                {selectedItems.followups.map((f, i) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg border border-gold/40 p-4 transition-colors hover:border-gold"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon size={12} className="text-amber-700" />
                          <p className="text-sm font-semibold text-gray-900">{f.client_name}</p>
                        </div>
                        <span className="mt-1 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                          Follow-up{f.is_done ? ' · Done' : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate(`/inquiries/${f.inquiry_id}`)}
                        className="flex items-center gap-1 text-[10px] font-medium text-maroon hover:underline"
                      >
                        <ExternalLink size={11} /> View
                      </button>
                    </div>
                    {f.remarks && <p className="text-xs text-gray-500">{f.remarks}</p>}
                    {f.is_done && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                        <CheckCircle2 size={11} /> Completed
                      </p>
                    )}
                  </motion.div>
                ))}

                {selectedItems.events.map((event, i) => {
                  const statusMeta = INQUIRY_STATUSES[event.status as keyof typeof INQUIRY_STATUSES]
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-lg border border-gray-100 p-4 transition-colors hover:border-gray-200"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{event.client_name}</p>
                          <span className="mt-0.5 inline-block rounded-full bg-maroon/10 px-2 py-0.5 text-[10px] font-medium text-maroon">
                            {event.event_type}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {statusMeta && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusMeta.color}`}>
                              {statusMeta.label}
                            </span>
                          )}
                          <button
                            onClick={() => navigate(`/inquiries/${event.id}`)}
                            className="flex items-center gap-1 text-[10px] font-medium text-maroon hover:underline"
                          >
                            <ExternalLink size={11} /> View
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Users size={12} className="text-gray-400" /> {event.pax ?? '—'} guests
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </>
            )}

          {upcomingEvents.length > 0 && (
            <>
              <div className="border-t border-gray-100 px-5 py-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Upcoming Events</h4>
              </div>
              <div className="space-y-3 p-4">
                {upcomingEvents.map((event) => {
                  const statusMeta = INQUIRY_STATUSES[event.status as keyof typeof INQUIRY_STATUSES]
                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:border-gray-200"
                    >
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-maroon/5">
                        <span className="text-sm font-bold text-maroon">
                          {event.event_date ? new Date(event.event_date + 'T00:00:00').getDate() : '—'}
                        </span>
                        <span className="text-[9px] font-medium uppercase text-maroon/70">
                          {event.event_date ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }) : ''}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{event.client_name}</p>
                        <p className="truncate text-xs text-gray-500">{event.event_type} · {event.pax ?? '—'} guests</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {statusMeta && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusMeta.color}`}>
                            {statusMeta.label}
                          </span>
                        )}
                        <button
                          onClick={() => navigate(`/inquiries/${event.id}`)}
                          className="flex items-center gap-1 text-[10px] font-medium text-maroon hover:underline"
                        >
                          <ExternalLink size={11} /> View
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
