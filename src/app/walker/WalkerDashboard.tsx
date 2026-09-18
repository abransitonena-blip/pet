'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronDown, History } from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import WalkerSessionCard from '@/components/walker/WalkerSessionCard'
import { useWalkerPanel } from '@/app/walker/WalkerPanelContext'
import { advanceWalkerSession, useWalkerSessions } from '@/lib/useServiceOrders'
import { useSubmittedReports } from '@/lib/useSubmittedReports'
import {
  planWalkerDay,
  sortWalkerSessions,
  walkerReadErrorMessage,
} from '@/lib/walkerPanel'
import type { WalkSession } from '@/types'

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA')
}

// El horario del perfil puede venir con cualquiera de las tres escrituras de
// día que conviven en los datos (monday, lunes, lun).
const DAY_LABELS: Record<string, string> = {
  monday: 'Lun', lunes: 'Lun', lun: 'Lun',
  tuesday: 'Mar', martes: 'Mar', mar: 'Mar',
  wednesday: 'Mié', miercoles: 'Mié', miércoles: 'Mié', mie: 'Mié',
  thursday: 'Jue', jueves: 'Jue', jue: 'Jue',
  friday: 'Vie', viernes: 'Vie', vie: 'Vie',
  saturday: 'Sáb', sabado: 'Sáb', sábado: 'Sáb', sab: 'Sáb',
  sunday: 'Dom', domingo: 'Dom', dom: 'Dom',
}

/**
 * La jornada del paseador. Se usa en la calle, con el teléfono en una mano:
 * arriba va el paseo que toca atender, y lo demás queda a un toque.
 */
export default function WalkerDashboard() {
  const { uid, profile } = useWalkerPanel()
  const today = todayKey()
  // Su carga de la semana: los últimos siete días. Es también el piso de la
  // consulta, para que los paseos viejos no desplacen a los de hoy.
  const weekStart = new Date(Date.now() - 6 * 86_400_000).toLocaleDateString('en-CA')
  const { sessions, loading, error, retry } = useWalkerSessions(uid, { since: weekStart })
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [weekOpen, setWeekOpen] = useState(false)

  const sorted = useMemo(() => sortWalkerSessions(sessions), [sessions])
  const day = useMemo(() => planWalkerDay(sorted, today, weekStart), [sorted, today, weekStart])
  const reports = useSubmittedReports(uid, day.recentCompleted.map((session) => session.id))
  const reportsToSend = reports.state === 'ready'
    ? day.recentCompleted.filter((session) => !reports.submitted.has(session.id))
    : []

  const scheduledDays = Object.entries(profile.schedule ?? {})
    .filter(([, slots]) => Array.isArray(slots) && slots.length > 0)
    .map(([dayName, slots]) => `${DAY_LABELS[dayName.toLowerCase()] ?? dayName} ${slots[0].start}–${slots[slots.length - 1].end}`)

  const advance = async (session: WalkSession) => {
    if (updatingId) return
    setUpdatingId(session.id)
    setActionError('')
    setActionSuccess('')
    try {
      await advanceWalkerSession(session)
      setActionSuccess('Listo, el paseo avanzó.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
      setActionError(message === 'walker-transition-conflict'
        ? 'El paseo cambió en otra sesión. La vista se actualizará antes de permitir otra acción.'
        : code.includes('permission-denied')
          ? 'No tienes permiso para realizar esta transición. Actualiza tu sesión o contacta a administración.'
          : 'No pudimos actualizar el paseo. Verifica tu conexión e inténtalo nuevamente.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return <LoadingState message="Consultando tus paseos asignados…" rows={4} height="h-20" />
  }

  if (error) {
    return (
      <Card className="p-4 shadow-none">
        <ErrorState description={walkerReadErrorMessage(error)} onRetry={retry} />
      </Card>
    )
  }

  const todayCount = day.restOfToday.length + (day.focus ? 1 : 0)
  const summary = [
    { label: 'por hacer', value: day.pendingToday },
    { label: 'en paseo', value: day.activeToday },
    { label: day.completedToday === 1 ? 'completado' : 'completados', value: day.completedToday },
  ]

  return (
    <div className="animate-enter space-y-5">
      <section aria-labelledby="walker-greeting" className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Mi jornada</p>
          <h1 id="walker-greeting" className="mt-1 truncate text-2xl font-bold tracking-tight text-ink">{profile.name}</h1>
          {/* Una línea en lugar de cuatro tarjetas: en un teléfono, las cuatro
              empujaban el paseo de hoy fuera de la primera pantalla. */}
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
            <span className="sr-only">Hoy:</span>
            {summary.map(({ label, value }) => (
              <span key={label}>
                <span className="font-semibold tabular-nums text-ink">{value}</span> {label}
              </span>
            ))}
          </p>
        </div>
        <Link
          href="/walker/historial"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
        >
          <History size={16} aria-hidden="true" /> Historial
        </Link>
      </section>

      {actionError && (
        <p className="rounded-xl bg-danger-500/10 px-4 py-3 text-sm text-red-700" role="alert">{actionError}</p>
      )}
      {actionSuccess && (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success-700" role="status">{actionSuccess}</p>
      )}

      <section aria-labelledby="today-walks-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="today-walks-title" className="text-base font-bold text-ink">Paseos de hoy</h2>
          <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold tabular-nums text-muted">{todayCount}</span>
        </div>

        {todayCount === 0 ? (
          <Card className="shadow-none">
            <EmptyState
              icon={<CalendarDays size={21} />}
              title="No tienes paseos asignados hoy"
              description="Puedes revisar tu disponibilidad o consultar las próximas asignaciones."
              action={(
                <Link href="/walker/perfil" className="inline-flex min-h-11 items-center rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  Revisar mi disponibilidad
                </Link>
              )}
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {day.focus && (
              <WalkerSessionCard
                key={day.focus.id}
                session={day.focus}
                onAdvance={(selected) => void advance(selected)}
                updating={updatingId === day.focus.id}
              />
            )}
            {day.restOfToday.map((session) => (
              <WalkerSessionCard
                key={session.id}
                session={session}
                onAdvance={(selected) => void advance(selected)}
                updating={updatingId === session.id}
                collapsible
              />
            ))}
          </div>
        )}
      </section>

      {/* Sólo se lista lo que de verdad falta: los completados cuyo reporte no
          está enviado. Si no se pudo comprobar, no se afirma nada. */}
      {reportsToSend.length > 0 && (
        <section aria-labelledby="reports-to-send-title">
          <h2 id="reports-to-send-title" className="text-base font-bold text-ink">Reportes por enviar</h2>
          <p className="mb-3 text-xs text-muted">Paseos de esta semana que ya terminaron y todavía no tienen su reporte enviado.</p>
          <div className="space-y-2">
            {reportsToSend.map((session) => <WalkerSessionCard key={session.id} session={session} compact />)}
          </div>
        </section>
      )}

      {day.upcoming.length > 0 && (
        <section aria-labelledby="upcoming-walks-title">
          <h2 id="upcoming-walks-title" className="mb-3 text-base font-bold text-ink">Próximos paseos</h2>
          <div className="space-y-2">
            {day.upcoming.map((session) => <WalkerSessionCard key={session.id} session={session} compact />)}
          </div>
        </section>
      )}

      <section aria-labelledby="week-title">
        <h2 id="week-title">
          <button
            type="button"
            onClick={() => setWeekOpen((open) => !open)}
            aria-expanded={weekOpen}
            aria-controls="week-panel"
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-1 text-left text-base font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Mi semana
            <ChevronDown size={18} aria-hidden="true" className={`text-muted transition-transform motion-reduce:transition-none ${weekOpen ? 'rotate-180' : ''}`} />
          </button>
        </h2>
        <div id="week-panel" hidden={!weekOpen} className="space-y-2 px-1 pt-1 text-sm text-muted">
          <p>
            <span className="font-semibold tabular-nums text-ink">{day.lastWeekCount}</span> {day.lastWeekCount === 1 ? 'paseo' : 'paseos'} en los últimos 7 días, sin contar cancelados.
          </p>
          {scheduledDays.length > 0 ? (
            <p>
              Tu horario registrado: {scheduledDays.join(' · ')}.{' '}
              <Link href="/walker/perfil" className="font-semibold text-primary underline-offset-2 hover:underline">Edítalo en tu perfil</Link>.
            </p>
          ) : (
            <p>
              No tienes horario registrado.{' '}
              <Link href="/walker/perfil" className="font-semibold text-primary underline-offset-2 hover:underline">Agrégalo en tu perfil</Link>.
            </p>
          )}
          <Link href="/walker/historial" className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline">
            Ver todos mis paseos
          </Link>
        </div>
      </section>
    </div>
  )
}
