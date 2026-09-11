'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Clock3, History, Route } from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import WalkerSessionCard from '@/components/walker/WalkerSessionCard'
import { useWalkerPanel } from '@/app/walker/WalkerPanelContext'
import { advanceWalkerSession, useWalkerSessions } from '@/lib/useServiceOrders'
import {
  sortWalkerSessions,
  walkerReadErrorMessage,
  walkerSessionDate,
  walkerSessionStatus,
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

export default function WalkerDashboard() {
  const { uid, profile } = useWalkerPanel()
  const { sessions, loading, error, retry } = useWalkerSessions(uid)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const today = todayKey()

  const sorted = useMemo(() => sortWalkerSessions(sessions), [sessions])
  const todaySessions = sorted.filter((session) => walkerSessionDate(session) === today)
  const pendingToday = todaySessions.filter((session) => ['assigned', 'confirmed', 'on_the_way', 'arrived'].includes(walkerSessionStatus(session)))
  const activeToday = todaySessions.filter((session) => walkerSessionStatus(session) === 'in_progress')
  const completedToday = todaySessions.filter((session) => walkerSessionStatus(session) === 'completed')
  const upcoming = sorted.filter((session) => {
    const status = walkerSessionStatus(session)
    return walkerSessionDate(session) > today && status !== 'completed' && status !== 'cancelled' && status !== 'no_show'
  }).slice(0, 3)
  const recentCompleted = sorted
    .filter((session) => walkerSessionDate(session) < today && walkerSessionStatus(session) === 'completed')
    .reverse()
    .slice(0, 3)

  // Su carga de la semana: los últimos siete días, sin contar lo cancelado.
  const weekStart = new Date(Date.now() - 6 * 86_400_000).toLocaleDateString('en-CA')
  const lastWeekCount = sorted.filter((session) => {
    const date = walkerSessionDate(session)
    const status = walkerSessionStatus(session)
    return date >= weekStart && date <= today && status !== 'cancelled' && status !== 'no_show'
  }).length
  const scheduledDays = Object.entries(profile.schedule ?? {})
    .filter(([, slots]) => Array.isArray(slots) && slots.length > 0)
    .map(([day, slots]) => `${DAY_LABELS[day.toLowerCase()] ?? day} ${slots[0].start}–${slots[slots.length - 1].end}`)

  const advance = async (session: WalkSession) => {
    if (updatingId) return
    setUpdatingId(session.id)
    setActionError('')
    setActionSuccess('')
    try {
      await advanceWalkerSession(session)
      setActionSuccess('Estado actualizado correctamente.')
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

  return (
    <div className="space-y-5">
      <section aria-labelledby="walker-greeting" className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Mi jornada</p>
          <h1 id="walker-greeting" className="mt-1 text-2xl font-bold tracking-tight text-ink">{profile.name}</h1>
          <p className="mt-1 text-sm text-muted">Aquí aparecen únicamente los paseos asignados a tu UID.</p>
        </div>
        <Link
          href="/walker/historial"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
        >
          <History size={16} aria-hidden="true" /> Ver historial
        </Link>
      </section>

      <section aria-label="Mi carga" className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: 'Pendientes hoy', value: pendingToday.length, icon: Clock3, tone: 'text-primary bg-primary/10' },
          { label: 'En paseo', value: activeToday.length, icon: Route, tone: 'text-blue-700 bg-blue-500/10' },
          { label: 'Completados hoy', value: completedToday.length, icon: CheckCircle2, tone: 'text-success-700 bg-success/10' },
          { label: 'Últimos 7 días', value: lastWeekCount, icon: CalendarDays, tone: 'text-ink bg-ink/[0.06]' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="min-h-20 p-3 shadow-none sm:p-4">
            <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}><Icon size={15} aria-hidden="true" /></div>
            <p className="text-xl font-bold leading-none text-ink">{value}</p>
            <p className="mt-1 truncate text-[11px] font-medium text-muted sm:text-xs">{label}</p>
          </Card>
        ))}
      </section>

      {scheduledDays.length > 0 && (
        <p className="text-xs text-muted">
          Tu horario registrado: {scheduledDays.join(' · ')}.{' '}
          <Link href="/walker/perfil" className="font-semibold text-primary underline-offset-2 hover:underline">Edítalo en tu perfil</Link>.
        </p>
      )}

      {actionError && (
        <p className="rounded-xl bg-danger-500/10 px-4 py-3 text-sm text-red-700" role="alert">{actionError}</p>
      )}
      {actionSuccess && (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success-700" role="status">{actionSuccess}</p>
      )}

      <section aria-labelledby="today-walks-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="today-walks-title" className="text-base font-bold text-ink">Paseos de hoy</h2>
            <p className="text-xs text-muted">Los cambios se guardan antes de actualizar el estado visible.</p>
          </div>
          <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-muted">{todaySessions.length}</span>
        </div>

        {todaySessions.length === 0 ? (
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
            {todaySessions.map((session) => (
              <WalkerSessionCard
                key={session.id}
                session={session}
                onAdvance={(selected) => void advance(selected)}
                updating={updatingId === session.id}
              />
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-walks-title">
          <h2 id="upcoming-walks-title" className="mb-3 text-base font-bold text-ink">Próximos paseos</h2>
          <div className="space-y-2">
            {upcoming.map((session) => <WalkerSessionCard key={session.id} session={session} compact />)}
          </div>
        </section>
      )}

      {recentCompleted.length > 0 && (
        <section aria-labelledby="recent-completed-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="recent-completed-title" className="text-base font-bold text-ink">Reportes pendientes de cierre</h2>
              <p className="text-xs text-muted">Paseos completados recientemente. Abre cada sesión para guardar o enviar su reporte.</p>
            </div>
            <Link href="/walker/historial" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Ver completados
            </Link>
          </div>
          <div className="space-y-2">
            {recentCompleted.map((session) => <WalkerSessionCard key={session.id} session={session} compact />)}
          </div>
        </section>
      )}
    </div>
  )
}
