'use client'

import { useState, useMemo } from 'react'
import { CalendarDays, Clock, Loader2, Check, X } from 'lucide-react'
import { generateTimeSlots, getDayOfWeek } from '@/lib/defaultConfig'

export default function StepSchedule({
  form, set, isWeeklyPackage, weeklySchedule, setWeeklySchedule,
  bookedSlots, loadingSlots,
}: {
  form: { service: string; date: string; time: string }
  set: (key: string, val: string) => void
  isWeeklyPackage: boolean
  weeklySchedule: Record<string, string>
  setWeeklySchedule: React.Dispatch<React.SetStateAction<Record<string, string>>>
  bookedSlots: string[]
  loadingSlots: boolean
}) {
  const today = new Date().toISOString().split('T')[0]
  const timeSlots = form.date ? generateTimeSlots(getDayOfWeek(form.date)) : []

  const weekDays = useMemo(() => {
    const start = form.date ? new Date(form.date + 'T12:00:00') : new Date()
    if (!form.date) {
      const day = start.getDay()
      const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
      start.setDate(start.getDate() + diff)
    } else {
      const day = start.getDay()
      const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
      start.setDate(start.getDate() + diff)
    }
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return {
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }),
        dayName: d.toLocaleDateString('es-MX', { weekday: 'long' }),
      }
    })
  }, [form.date])

  if (isWeeklyPackage) {
    return (
      <div>
        <h3 className="text-lg sm:text-xl font-bold mb-1">Elige tu semana</h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Selecciona la fecha de inicio y los horarios para cada día
        </p>

        <div className="space-y-2 mb-6">
          <label htmlFor="week-start" className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <CalendarDays size={13} className="text-primary" /> Fecha de inicio (lunes)
          </label>
          <input
            id="week-start"
            type="date"
            value={form.date}
            onChange={(e) => {
              set('date', e.target.value)
              setWeeklySchedule({})
            }}
            min={today}
            className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {form.date && (
          <div className="space-y-3">
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Selecciona el horario para cada día (mínimo 1)
            </p>
            {weekDays.map((day) => {
              const dayTimeSlots = generateTimeSlots(getDayOfWeek(day.date))
              const selectedTime = weeklySchedule[day.date] || ''
              return (
                <div key={day.date} className="rounded-xl p-3" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{day.label}</span>
                    {selectedTime && (
                      <span className="text-2xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                        {selectedTime}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {dayTimeSlots.map((slot) => (
                      <button
                        key={`${day.date}-${slot}`}
                        type="button"
                        onClick={() => setWeeklySchedule((prev) => ({ ...prev, [day.date]: prev[day.date] === slot ? '' : slot }))}
                        className="py-1.5 rounded-lg text-2xs font-medium transition-all border"
                        style={{
                          background: selectedTime === slot ? 'var(--color-primary-light)' : 'var(--glass-bg)',
                          borderColor: selectedTime === slot ? 'var(--color-primary)' : 'var(--border)',
                          color: selectedTime === slot ? 'var(--color-primary)' : 'var(--text-muted)',
                          minHeight: '32px',
                        }}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {Object.values(weeklySchedule).filter(Boolean).length} de 6 días programados
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-lg sm:text-xl font-bold mb-1">¿Cuándo lo paseamos?</h3>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Selecciona fecha y hora disponible</p>

      <div className="space-y-2 mb-6">
        <label htmlFor="reservation-date" className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <CalendarDays size={13} className="text-primary" /> Fecha <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          id="reservation-date"
          type="date"
          value={form.date}
          onChange={(e) => { set('date', e.target.value); set('time', '') }}
          min={today}
          required
          className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
        {form.date && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(form.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        )}
      </div>

      {form.date && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Clock size={13} className="text-primary" /> Hora <span style={{ color: 'var(--color-danger)' }}>*</span>
            {loadingSlots && <Loader2 className="animate-spin" size={11} />}
          </label>
          {timeSlots.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
              No hay servicio este día
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {timeSlots.map((slot) => {
                const booked = bookedSlots.includes(slot)
                const selected = form.time === slot
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={booked}
                    onClick={() => set('time', slot)}
                    className="relative py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border"
                    style={{
                      background: booked ? 'var(--color-error-light)' : selected ? 'var(--color-primary-light)' : 'var(--glass-bg)',
                      borderColor: selected ? 'var(--color-primary)' : booked ? 'var(--color-error)' : 'var(--border)',
                      color: booked ? 'var(--color-error)' : selected ? 'var(--color-primary)' : 'var(--text-secondary)',
                      cursor: booked ? 'not-allowed' : 'pointer',
                      textDecoration: booked ? 'line-through' : 'none',
                      minHeight: '44px',
                    }}
                  >
                    {slot}
                    {booked && <X size={9} className="absolute top-1 right-1 text-red-400/40" />}
                    {selected && <Check size={9} className="absolute top-1 right-1 text-primary" />}
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {timeSlots.length - bookedSlots.length} de {timeSlots.length} horarios disponibles
          </p>
        </div>
      )}
    </div>
  )
}
