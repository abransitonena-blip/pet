'use client'

import { useCallback, useEffect, useState } from 'react'
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { CalendarClock, Save } from 'lucide-react'
import { db } from '@/firebase/config'
import { Button, ConfirmDialog, ErrorState, LoadingState } from '@/components/ui'
import {
  BOOKING_DAY_KEYS,
  BOOKING_SLOT_INTERVALS,
  createEmptyBookingSchedule,
  parseBookingSchedule,
  type BookingDayKey,
  type BookingSchedule,
} from '@/lib/bookingSchedule'
import { ROLES } from '@/lib/roles'
import { useSessionRole } from '@/lib/useSessionRole'

type State = 'loading' | 'ready' | 'permission' | 'network'

const DAY_LABELS: Record<BookingDayKey, string> = {
  domingo: 'Domingo', lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado',
}

export default function AdminBookingSchedule() {
  const session = useSessionRole([ROLES.ADMIN, ROLES.SUPERVISOR])
  const [draft, setDraft] = useState<BookingSchedule>(createEmptyBookingSchedule)
  const [state, setState] = useState<State>('loading')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const readOnly = session.role !== ROLES.ADMIN

  const load = useCallback(async () => {
    if (session.status !== 'ready') return
    setState('loading')
    try {
      const snapshot = await getDoc(doc(db, 'appSettings', 'bookingSchedule'))
      setDraft(snapshot.exists() ? parseBookingSchedule(snapshot.data()) ?? createEmptyBookingSchedule() : createEmptyBookingSchedule())
      setState('ready')
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
      setState(code.includes('permission-denied') ? 'permission' : 'network')
    }
  }, [session.status])

  useEffect(() => { void load() }, [load])

  const updateDay = (day: BookingDayKey, updates: Partial<BookingSchedule['weeklyHours'][BookingDayKey]>) => {
    setDraft((current) => ({
      ...current,
      weeklyHours: { ...current.weeklyHours, [day]: { ...current.weeklyHours[day], ...updates } },
    }))
  }

  const save = async () => {
    if (!session.uid || readOnly) return
    const actorUid = session.uid
    setSaving(true)
    setMessage('')
    try {
      const reference = doc(db, 'appSettings', 'bookingSchedule')
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference)
        const current = snapshot.exists() ? parseBookingSchedule(snapshot.data()) : null
        if (snapshot.exists() && !current) throw new Error('BOOKING_SCHEDULE_INVALID_REMOTE')
        if ((current?.version ?? 0) !== draft.version) throw new Error('BOOKING_SCHEDULE_CONFLICT')
        const candidate: BookingSchedule = {
          ...draft,
          version: (current?.version ?? 0) + 1,
          updatedAt: null,
          updatedBy: actorUid,
        }
        if (!parseBookingSchedule(candidate)) throw new Error('BOOKING_SCHEDULE_INVALID')
        transaction.set(reference, { ...candidate, updatedAt: serverTimestamp() })
      })
      setConfirmOpen(false)
      setMessage('Horario actualizado. Las nuevas solicitudes usarán esta versión; no confirma disponibilidad.')
      await load()
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      setMessage(code === 'BOOKING_SCHEDULE_CONFLICT'
        ? 'La configuración cambió en otra sesión. Recarga antes de volver a guardar.'
        : code.includes('permission') ? 'No tienes permiso para modificar el horario.'
        : code.includes('INVALID') ? 'Completa horas válidas y asegúrate de que el cierre sea posterior a la apertura.'
        : 'No pudimos guardar el horario. Revisa tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  if (session.status === 'loading' || state === 'loading') return <LoadingState message="Consultando horario de reservas…" rows={3} />
  if (state === 'permission' || state === 'network') return <ErrorState description={state === 'permission' ? 'No tienes permiso para consultar el horario.' : 'No pudimos consultar el horario.'} onRetry={() => void load()} />

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-4">
        <CalendarClock className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden="true" />
        <div><p className="text-sm font-semibold text-ink">Horario solicitado, no disponibilidad confirmada</p><p className="mt-1 text-xs text-muted">Zona horaria fija: America/Mexico_City. Si permanece inactivo, Familia no podrá elegir horarios.</p></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium text-ink">Intervalo
          <select disabled={readOnly} value={draft.slotIntervalMinutes} onChange={(event) => setDraft((current) => ({ ...current, slotIntervalMinutes: Number(event.target.value) as BookingSchedule['slotIntervalMinutes'] }))} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {BOOKING_SLOT_INTERVALS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-ink">Anticipación mínima
          <input disabled={readOnly} type="number" min={0} max={10080} step={15} value={draft.minimumLeadMinutes} onChange={(event) => setDraft((current) => ({ ...current, minimumLeadMinutes: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          <span className="mt-1 block text-xs text-muted">Minutos</span>
        </label>
        <label className="flex min-h-11 items-center gap-3 self-start rounded-xl border border-border px-3 text-sm font-medium text-ink sm:mt-6">
          <input disabled={readOnly} type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} className="h-5 w-5 accent-primary" /> Activo
        </label>
      </div>

      <div className="divide-y divide-ink/10">
        {BOOKING_DAY_KEYS.map((day) => {
          const hours = draft.weeklyHours[day]
          return <div key={day} className="grid gap-3 py-3 sm:grid-cols-[minmax(130px,1fr)_1fr_1fr] sm:items-center">
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink"><input disabled={readOnly} type="checkbox" checked={hours.enabled} onChange={(event) => updateDay(day, { enabled: event.target.checked, open: event.target.checked ? hours.open : '', close: event.target.checked ? hours.close : '' })} className="h-5 w-5 accent-primary" />{DAY_LABELS[day]}</label>
            <label className="text-xs font-medium text-muted">Abre<input disabled={readOnly || !hours.enabled} type="time" step={900} value={hours.open} onChange={(event) => updateDay(day, { open: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-ink" /></label>
            <label className="text-xs font-medium text-muted">Cierra<input disabled={readOnly || !hours.enabled} type="time" step={900} value={hours.close} onChange={(event) => updateDay(day, { close: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-ink" /></label>
          </div>
        })}
      </div>

      <label className="block text-sm font-medium text-ink">Días cerrados
        <textarea
          disabled={readOnly}
          rows={3}
          value={draft.closedDates.join('\n')}
          onChange={(event) => setDraft((current) => ({
            ...current,
            closedDates: Array.from(new Set(event.target.value.split(/\s+/).map((value) => value.trim()).filter(Boolean))).slice(0, 366),
          }))}
          placeholder="AAAA-MM-DD, una fecha por línea"
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <span className="mt-1 block text-xs text-muted">Formato AAAA-MM-DD. Estas fechas no generan horarios.</span>
      </label>

      {message && <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-ink">{message}</p>}
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted">Versión {draft.version || 'sin publicar'}</p>{readOnly ? <p className="text-sm text-muted">Supervisor: solo lectura</p> : <Button onClick={() => setConfirmOpen(true)} disabled={saving} leftIcon={<Save size={16} aria-hidden="true" />}>Guardar horario</Button>}</div>
      <ConfirmDialog open={confirmOpen} onCancel={() => setConfirmOpen(false)} onConfirm={() => void save()} title="Guardar horario de solicitudes" description="Este horario controla las opciones que verá Familia PET. No confirma disponibilidad de un Walker." confirmLabel="Guardar horario" loading={saving} />
    </div>
  )
}
