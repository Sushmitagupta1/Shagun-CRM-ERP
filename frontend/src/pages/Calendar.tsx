import { useState } from 'react'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import { ChevronLeft, ChevronRight, Clock, MapPin, Users } from 'lucide-react'

const events = [
  { id: '1', client: 'Priya & Rahul Sharma', type: 'Wedding', date: '2026-07-24', time: '10:00 AM', venue: 'JW Marriott', pax: 250, status: 'confirmed' },
  { id: '2', client: 'Tata Motors Corp', type: 'Corporate Gala', date: '2026-07-24', time: '2:30 PM', venue: 'Taj Lands End', pax: 150, status: 'confirmed' },
  { id: '3', client: 'Mehta Family', type: 'Birthday', date: '2026-07-25', time: '11:00 AM', venue: 'Grand Hyatt', pax: 80, status: 'confirmed' },
  { id: '4', client: 'Agarwal Family', type: 'Anniversary', date: '2026-07-26', time: '7:00 PM', venue: 'The Leela', pax: 120, status: 'confirmed' },
  { id: '5', client: 'Gupta Wedding', type: 'Wedding', date: '2026-07-28', time: '6:00 PM', venue: 'ITC Grand Bharat', pax: 300, status: 'confirmed' },
  { id: '6', client: 'Infosys Team Dinner', type: 'Corporate', date: '2026-07-30', time: '8:00 PM', venue: 'Trident BKC', pax: 60, status: 'confirmed' },
  { id: '7', client: 'Kapoor Engagement', type: 'Engagement', date: '2026-08-02', time: '5:00 PM', venue: 'Sahara Star', pax: 100, status: 'pending' },
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const dayShort = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function CalendarPage() {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  )

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)

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
    setSelectedDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
  }

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((e) => e.date === dateStr)
  }

  const selectedEvents = (() => {
    const parts = selectedDate.split('-')
    const day = parseInt(parts[2])
    return getEventsForDate(day)
  })()

  const isToday = (day: number) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="View events by date"
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
              const dayEvents = getEventsForDate(day)
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSelected = dateStr === selectedDate
              const todayFlag = isToday(day)

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
                    {dayEvents.slice(0, 2).map((e) => (
                      <div
                        key={e.id}
                        className={`truncate rounded px-1 py-0.5 text-[9px] font-medium ${
                          e.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {e.client}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-gray-400">+{dayEvents.length - 2} more</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Selected Date Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-xl border border-gray-100 bg-white shadow-md"
        >
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <p className="text-xs text-gray-500">{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="space-y-3 p-4">
            {selectedEvents.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">No events on this date</p>
              </div>
            ) : (
              selectedEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-lg border border-gray-100 p-4 transition-colors hover:border-gray-200"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{event.client}</p>
                      <span className="mt-0.5 inline-block rounded-full bg-maroon/10 px-2 py-0.5 text-[10px] font-medium text-maroon">
                        {event.type}
                      </span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      event.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {event.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Clock size={12} className="text-gray-400" /> {event.time}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <MapPin size={12} className="text-gray-400" /> {event.venue}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Users size={12} className="text-gray-400" /> {event.pax} guests
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
