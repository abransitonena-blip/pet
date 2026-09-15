'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ChevronDown, UserRoundCheck } from 'lucide-react'
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import {
  assignCanonicalWalkSession,
  canonicalReadErrorMessage,
  CanonicalOperationError,
  reprogramCanonicalWalkSession,
  useActiveWalkerOptions,
  useCanonicalAddressZones,
  useRequestedWalkSessions,
  type CanonicalWalkSession,
} from '@/lib/useCanonicalWalkSessions'
import { notifySessionEvent } from '@/lib/push/pushClient'
import { getReservationServiceDefinitions } from '@/lib/walkServices'
import { dispatchUrgency, orderDispatchQueue, URGENCY_LABELS, type DispatchUrgency } from '@/lib/dispatchQueue'
import { whenLabel } from '@/lib/dateLabels'

type PendingAction =
  | { type: 'assign'; session: CanonicalWalkSession; walkerId: string }
  | { type: 'reprogram'; session: CanonicalWalkSession; scheduledDate: string; scheduledStart: string }

const SERVICE_NAMES = new Map(getReservationServiceDefinitions().map((service) => [service.id, service.name]))

// El color no es el único aviso: cada estado lleva su palabra.
const URGENCY_STYLES: Record<DispatchUrgency, string> = {
  overdue: 'bg-danger-500/10 text-red-700',
  today: 'bg-warning/10 text-amber-800',
  tomorrow: 'bg-primary/10 text-primary',
  later: 'bg-ink/5 text-muted',
}

function shortId(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`
}

function operationMessage(error: unknown): string {
  if (error instanceof CanonicalOperationError) {
    if (error.code === 'conflict') return 'La solicitud cambió mientras la revisabas. Actualiza la lista antes de continuar.'
    if (error.code === 'walker-not-active') return 'El paseador seleccionado ya no está activo.'
    if (error.code === 'not-found') return 'La solicitud ya no existe.'
  }
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
  if (code.includes('permission-denied')) return 'Tu sesión no tiene permiso para completar esta operación.'
  return 'No pudimos guardar el cambio. Revisa tu conexión e inténtalo nuevamente.'
}

export default function CanonicalDispatchPanel() {
  const queue = useRequestedWalkSessions()
  const walkerOptions = useActiveWalkerOptions()
  const addressZones = useCanonicalAddressZones(queue.sessions.map((session) => session.addressId))
  const [selectedWalkers, setSelectedWalkers] = useState<Record<string, string>>({})
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, { date: string; time: string }>>({})
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  // Cambiar el horario es la acción rara; asignar es la de todos los días.
  const [reprogramOpen, setReprogramOpen] = useState<string | null>(null)
  const today = new Date().toLocaleDateString('en-CA')
  const ordered = useMemo(() => orderDispatchQueue(queue.sessions), [queue.sessions])
  const overdue = ordered.filter((session) => dispatchUrgency(session.scheduledDate, today) === 'overdue').length

  const confirmAction = async () => {
    if (!pendingAction || saving) return
    setSaving(true)
    setMessage(null)
    try {
      if (pendingAction.type === 'assign') {
        await assignCanonicalWalkSession(pendingAction.session.id, pendingAction.walkerId)
        notifySessionEvent(pendingAction.session.id)
        setMessage({ tone: 'success', text: 'Paseador asignado. La sesión ya puede aparecer en su panel.' })
      } else {
        await reprogramCanonicalWalkSession(pendingAction.session.id, {
          scheduledDate: pendingAction.scheduledDate,
          scheduledStart: pendingAction.scheduledStart,
        })
        setMessage({ tone: 'success', text: 'Horario actualizado correctamente.' })
        setReprogramOpen(null)
      }
      setPendingAction(null)
    } catch (error) {
      setMessage({ tone: 'error', text: operationMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  if (queue.loading || walkerOptions.loading) {
    return <LoadingState message="Consultando solicitudes y paseadores activos…" rows={4} height="h-28" />
  }
  if (queue.error || walkerOptions.error || addressZones.error) {
    const error = queue.error ?? walkerOptions.error ?? addressZones.error
    return <ErrorState description={error ? canonicalReadErrorMessage(error) : undefined} onRetry={queue.retry} />
  }

  return (
    <section aria-labelledby="canonical-dispatch-title" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="canonical-dispatch-title" className="text-lg font-bold text-ink">Solicitudes por asignar</h2>
          <p className="text-sm text-muted">La que urge primero, por la fecha del paseo.</p>
        </div>
        <p className="flex flex-wrap gap-2 self-start text-xs font-semibold">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">{queue.sessions.length} por asignar</span>
          {overdue > 0 && <span className="rounded-full bg-danger-500/10 px-3 py-1 text-red-700">{overdue} con fecha pasada</span>}
        </p>
      </div>

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-xl px-4 py-3 text-sm ${message.tone === 'error' ? 'bg-danger-500/10 text-red-700' : 'bg-success/10 text-success-700'}`}
        >
          {message.text}
        </p>
      )}

      {queue.sessions.length === 0 ? (
        <Card className="shadow-none">
          <EmptyState
            icon={<CheckCircle2 size={22} />}
            title="No hay solicitudes pendientes"
            description="Cuando una familia pida un paseo, aparecerá aquí para asignarlo."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {ordered.map((session) => {
            const selectedWalker = selectedWalkers[session.id] ?? ''
            const schedule = scheduleDrafts[session.id] ?? { date: session.scheduledDate, time: session.scheduledStart }
            const urgency = dispatchUrgency(session.scheduledDate, today)
            const reprogramming = reprogramOpen === session.id
            return (
              <Card key={session.id} className="p-4 shadow-none sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${URGENCY_STYLES[urgency]}`}>{URGENCY_LABELS[urgency]}</span>
                      <span className="font-mono text-xs text-muted" title={session.id}>{shortId(session.id)}</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                      <div><dt className="text-xs text-muted">Fecha</dt><dd className="mt-1 font-semibold text-ink">{session.scheduledDate ? whenLabel(session.scheduledDate, today) : 'Sin fecha'}</dd></div>
                      <div><dt className="text-xs text-muted">Horario</dt><dd className="mt-1 font-semibold text-ink">{session.scheduledStart}</dd></div>
                      <div><dt className="text-xs text-muted">Servicio</dt><dd className="mt-1 truncate font-semibold text-ink">{SERVICE_NAMES.get(session.serviceId) || session.serviceId}</dd></div>
                      <div><dt className="text-xs text-muted">Perros</dt><dd className="mt-1 font-semibold text-ink">{session.dogIds.length}</dd></div>
                      <div><dt className="text-xs text-muted">Zona</dt><dd className="mt-1 truncate font-semibold text-ink">{addressZones.zonesByAddress[session.addressId] || 'Consultando…'}</dd></div>
                    </dl>
                  </div>

                  <div className="w-full space-y-3 lg:w-80">
                    <label className="block text-xs font-semibold text-ink" htmlFor={`walker-${session.id}`}>Paseador</label>
                    <select
                      id={`walker-${session.id}`}
                      value={selectedWalker}
                      onChange={(event) => setSelectedWalkers((current) => ({ ...current, [session.id]: event.target.value }))}
                      className="input-field min-h-11 w-full"
                    >
                      <option value="">Elige un paseador activo</option>
                      {walkerOptions.walkers.map((walker) => <option key={walker.uid} value={walker.uid}>{walker.name}</option>)}
                    </select>
                    <Button
                      className="w-full"
                      disabled={!selectedWalker}
                      leftIcon={<UserRoundCheck size={16} />}
                      onClick={() => setPendingAction({ type: 'assign', session, walkerId: selectedWalker })}
                    >
                      Revisar asignación
                    </Button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setReprogramOpen(reprogramming ? null : session.id)}
                  aria-expanded={reprogramming}
                  aria-controls={`reprogram-${session.id}`}
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <CalendarClock size={16} aria-hidden="true" /> Cambiar fecha u hora
                  <ChevronDown size={16} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${reprogramming ? 'rotate-180' : ''}`} />
                </button>
                <div id={`reprogram-${session.id}`} hidden={!reprogramming} className="mt-2 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label htmlFor={`date-${session.id}`} className="text-xs font-semibold text-ink">Nueva fecha</label>
                    <input
                      id={`date-${session.id}`}
                      type="date"
                      value={schedule.date}
                      onChange={(event) => setScheduleDrafts((current) => ({ ...current, [session.id]: { ...schedule, date: event.target.value } }))}
                      className="input-field mt-1 min-h-11 w-full"
                    />
                  </div>
                  <div>
                    <label htmlFor={`time-${session.id}`} className="text-xs font-semibold text-ink">Nueva hora</label>
                    <input
                      id={`time-${session.id}`}
                      type="time"
                      value={schedule.time}
                      onChange={(event) => setScheduleDrafts((current) => ({ ...current, [session.id]: { ...schedule, time: event.target.value } }))}
                      className="input-field mt-1 min-h-11 w-full"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    className="self-end"
                    disabled={!schedule.date || !schedule.time || (schedule.date === session.scheduledDate && schedule.time === session.scheduledStart)}
                    leftIcon={<CalendarClock size={16} />}
                    onClick={() => setPendingAction({
                      type: 'reprogram', session, scheduledDate: schedule.date, scheduledStart: schedule.time,
                    })}
                  >
                    Revisar cambio
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted">
        Al confirmar se vuelve a comprobar que la solicitud siga sin asignar y que el paseador siga activo. Si alguien más la asignó primero, se te avisa y no se sobrescribe.
      </p>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.type === 'assign' ? 'Confirmar asignación' : 'Confirmar reprogramación'}
        description={pendingAction?.type === 'assign'
          ? 'La sesión cambiará de Solicitada a Asignada. Confirma que revisaste zona, horario y capacidad.'
          : 'El horario solicitado cambiará, pero la asignación y los datos del servicio permanecerán intactos.'}
        confirmLabel={pendingAction?.type === 'assign' ? 'Asignar paseador' : 'Guardar horario'}
        loading={saving}
        onConfirm={() => void confirmAction()}
        onCancel={() => { if (!saving) setPendingAction(null) }}
      />
    </section>
  )
}
