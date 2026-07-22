'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

import type { Reservation } from '@/types'
export default function CalendarView({ reservations }: { reservations: Reservation[] }) {
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const reservationsByDate = useMemo(() => {
    const map: Record<string, Reservation[]> = {}
    reservations.forEach((r) => {
      const key = r.date
      if (!map[key]) map[key] = []
      map[key].push(r)
    })
    return map
  }, [reservations])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
    setSelectedDay(null)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
    setSelectedDay(null)
  }

  const formatDateKey = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const selectedDateKey = selectedDay ? formatDateKey(selectedDay) : null
  const selectedReservations = selectedDateKey ? reservationsByDate[selectedDateKey] || [] : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all">
          <FaChevronLeft size={12} />
        </button>
        <span className="text-white font-semibold">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all">
          <FaChevronRight size={12} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs text-white/30 py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateKey = formatDateKey(day)
          const dayReservations = reservationsByDate[dateKey] || []
          const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
          const isSelected = day === selectedDay

          return (
            <motion.button
              key={day}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={`relative p-2 rounded-xl text-sm transition-all flex flex-col items-center ${
                isSelected
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : isToday
                    ? 'bg-white/10 text-white border border-white/10'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-xs leading-none">{day}</span>
              {dayReservations.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {dayReservations.slice(0, 3).map((_, idx) => (
                    <div key={idx} className="w-1 h-1 rounded-full bg-primary" />
                  ))}
                  {dayReservations.length > 3 && (
                    <span className="text-[8px] text-primary">+{dayReservations.length - 3}</span>
                  )}
                </div>
              )}
            </motion.button>
          )
        })}
      </div>

      {selectedReservations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-2"
        >
          <p className="text-xs text-white/40 mb-2">
            Reservas para {selectedDay} de {MONTHS[month]}:
          </p>
          {selectedReservations.map((r: Reservation) => (
            <div key={r.id} className="glass p-3 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-white">{r.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  r.status === 'completed' ? 'bg-green-500/20' : 'bg-secondary/20 text-secondary'
                }`}>
                  {r.status === 'completed' ? 'Completada' : 'Pendiente'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/50">
                <span>🐾 {r.petName}</span>
                <span>📋 {r.service}</span>
                <span>⏰ {r.time}</span>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {selectedDay && selectedReservations.length === 0 && (
        <p className="text-center text-white/20 text-sm mt-4">Sin reservas este día</p>
      )}
    </div>
  )
}
