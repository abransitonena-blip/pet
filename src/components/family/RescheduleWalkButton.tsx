'use client'

import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Button, ConfirmDialog } from '@/components/ui'
import { canCancel, cancelErrorMessage, rescheduleOwnWalk } from '@/lib/familyCancellation'
import { generateTimeSlots, getDayOfWeek } from '@/lib/defaultConfig'
import type { WalkSessionStatus } from '@/lib/domainStates'

/**
 * Mover un paseo a otro día, desde el panel de familia.
 *
 * Antes había que cancelar y volver a solicitar, con lo que la familia perdía
 * su lugar y el equipo veía dos movimientos donde había uno.
 *
 * Los horarios son los mismos que ofrece el formulario de reserva, del mismo
 * sitio: si administración cambia el horario de atención, esto cambia con él.
 * Y se dice antes de confirmar que el paseo vuelve a la cola: mover la hora
 * puede dejar al paseador asignado fuera de su disponibilidad.
 */
export default function RescheduleWalkButton({ sessionId, uid, status, currentDate, onMoved }: {
  sessionId: string
  uid: string
  status: WalkSessionStatus
  currentDate?: string
  onMoved?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  if (!canCancel(status)) return null

  const today = new Date().toLocaleDateString('en-CA')
  const slots = date ? generateTimeSlots(getDayOfWeek(date)) : []
  const closedDay = Boolean(date) && slots.length === 0

  const confirm = async () => {
    const [start, end] = slot.split('-')
    if (!date || !start || !end) {
      setError('Elige el día y la hora.')
      return
    }
    setWorking(true)
    setError('')
    const result = await rescheduleOwnWalk({ sessionId, uid, status, date, start, end })
    setWorking(false)
    if (result.ok) {
      setOpen(false)
      setDate('')
      setSlot('')
      onMoved?.()
      return
    }
    setError(cancelErrorMessage(result.reason))
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        leftIcon={<CalendarClock size={14} />}
        className="text-primary"
      >
        Cambiar de día
      </Button>

      <ConfirmDialog
        open={open}
        title="¿Mover este paseo?"
        description="El paseo vuelve a la lista por asignar: quien lo iba a llevar puede no estar libre a la hora nueva. El equipo lo reasigna."
        confirmLabel="Mover el paseo"
        cancelLabel="Dejarlo como está"
        loading={working}
        icon={<CalendarClock size={18} />}
        onConfirm={() => void confirm()}
        onCancel={() => { if (!working) { setOpen(false); setError('') } }}
      >
        <div className="mt-3 space-y-3 text-left">
          <div>
            <label htmlFor={`reschedule-date-${sessionId}`} className="text-xs font-medium text-muted">Nuevo día</label>
            <input
              id={`reschedule-date-${sessionId}`}
              type="date"
              value={date}
              min={today}
              onChange={(event) => { setDate(event.target.value); setSlot('') }}
              className="input-field mt-1 min-h-11 w-full"
            />
            {currentDate && <p className="mt-1 text-2xs text-muted">Hoy está agendado para el {currentDate}.</p>}
          </div>

          <div>
            <label htmlFor={`reschedule-slot-${sessionId}`} className="text-xs font-medium text-muted">Hora de llegada</label>
            <select
              id={`reschedule-slot-${sessionId}`}
              value={slot}
              onChange={(event) => setSlot(event.target.value)}
              disabled={slots.length === 0}
              className="input-field mt-1 min-h-11 w-full"
            >
              <option value="">{date ? 'Elige una hora' : 'Elige primero el día'}</option>
              {slots.map((option) => <option key={option} value={option}>{option.replace('-', ' a ')}</option>)}
            </select>
            {closedDay && <p className="mt-1 text-2xs text-amber-800">Ese día no hay servicio. Elige otro.</p>}
          </div>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
      </ConfirmDialog>
    </>
  )
}
