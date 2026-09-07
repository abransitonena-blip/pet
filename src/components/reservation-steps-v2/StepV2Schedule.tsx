'use client'

import { useMemo } from 'react'
import { Calendar, Clock } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { buildBookingSlots, dateInTimezone } from '@/lib/bookingSchedule'
import { useBookingSchedule } from '@/lib/useBookingSchedule'

interface StepV2ScheduleProps {
  form: { date: string; time: string; windowStart: string; windowEnd: string; serviceDurationMinutes: number | null }
  updateForm: (updates: Partial<{ whenType: 'scheduled'; date: string; time: string; windowStart: string; windowEnd: string }>) => void
  onNext: () => void
  onBack: () => void
}

export default function StepV2Schedule({ form, updateForm, onNext, onBack }: StepV2ScheduleProps) {
  const { schedule, status } = useBookingSchedule()
  const today = dateInTimezone(Date.now())
  const slots = useMemo(() => schedule && form.date && form.serviceDurationMinutes
    ? buildBookingSlots(schedule, form.date, form.serviceDurationMinutes)
    : [], [form.date, form.serviceDurationMinutes, schedule])
  const selected = slots.some((slot) => slot.start === form.windowStart && slot.end === form.windowEnd)
  const unavailable = status !== 'ready' || !schedule?.active

  return (
    <div className="space-y-5">
      <div><h3 className="text-base font-semibold text-ink">Fecha y horario</h3><p className="mt-1 text-sm text-muted">Selecciona el horario que deseas. El equipo PET confirmará la disponibilidad.</p></div>

      {!form.serviceDurationMinutes && <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-ink" role="alert">El servicio no tiene una duración válida. Regresa y selecciona otra opción.</p>}
      {unavailable && <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-ink" role="alert">{status === 'permission-denied' ? 'No tienes permiso para consultar los horarios.' : status === 'network-error' ? 'No pudimos consultar los horarios. Revisa tu conexión.' : 'El equipo PET aún no configura el horario de solicitudes.'}</p>}

      <label className="block text-sm font-semibold text-ink" htmlFor="booking-date">Fecha
        <Input id="booking-date" type="date" min={today} value={form.date} disabled={unavailable || !form.serviceDurationMinutes} onChange={(event) => updateForm({ whenType: 'scheduled', date: event.target.value, time: '', windowStart: '', windowEnd: '' })} className="mt-2" />
      </label>

      {form.date && !unavailable && form.serviceDurationMinutes && (
        <section aria-labelledby="booking-slots-title">
          <div className="flex items-center gap-2"><Clock size={18} className="text-primary" aria-hidden="true" /><h4 id="booking-slots-title" className="text-sm font-semibold text-ink">Horarios disponibles para solicitar</h4></div>
          {slots.length === 0 ? <p className="mt-3 rounded-xl bg-ink/[0.04] px-4 py-3 text-sm text-muted">No hay horarios solicitables para esta fecha según la configuración vigente.</p> : <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Seleccionar horario">{slots.map((slot) => {
            const active = form.windowStart === slot.start && form.windowEnd === slot.end
            return <button key={slot.start} type="button" role="radio" aria-checked={active} onClick={() => updateForm({ whenType: 'scheduled', windowStart: slot.start, windowEnd: slot.end, time: `${slot.start}-${slot.end}` })} className={`min-h-11 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${active ? 'bg-primary text-primary-foreground' : 'bg-ink/[0.045] text-ink hover:bg-primary/10'}`}><span className="block text-sm font-bold">{slot.start}</span><span className={`block text-xs ${active ? 'text-primary-foreground/85' : 'text-muted'}`}>Termina {slot.end}</span></button>
          })}</div>}
        </section>
      )}

      {selected && <p className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-ink" role="status"><Calendar size={17} className="text-success-700" aria-hidden="true" />Inicio {form.windowStart} · Termina {form.windowEnd}</p>}
      <div className="flex justify-between gap-3 pt-2"><Button variant="secondary" onClick={onBack}>← Atrás</Button><Button onClick={onNext} disabled={!form.date || !selected}>Revisar solicitud</Button></div>
    </div>
  )
}
