'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, Dog, Footprints } from 'lucide-react'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { useRequestedWalkSessions } from '@/lib/useCanonicalWalkSessions'
import AdminWalkerStatus from '@/components/AdminWalkerStatus'
import DataCard from '@/components/ui/DataCard'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import { dispatchUrgency, orderDispatchQueue, URGENCY_LABELS, type DispatchUrgency } from '@/lib/dispatchQueue'
import { whenLabel } from '@/lib/dateLabels'
import { monthStart, summarizeDay, walksOnTheStreet } from '@/lib/adminSummary'
import { getReservationServiceDefinitions } from '@/lib/walkServices'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/sessionMachine'
import PushNudge from '@/components/push/PushNudge'

const SERVICE_NAMES = new Map(getReservationServiceDefinitions().map((service) => [service.id, service.name]))

const URGENCY_STYLES: Record<DispatchUrgency, string> = {
  overdue: 'bg-danger-500/10 text-red-700',
  today: 'bg-warning/10 text-amber-800',
  tomorrow: 'bg-primary/10 text-primary',
  later: 'bg-ink/5 text-muted',
}

/**
 * El Resumen: lo primero que abre quien opera. Arriba va lo que pide una
 * decisión -- las solicitudes sin paseador --, luego el día y el equipo.
 *
 * Lo que se fue, y por qué:
 * - "Pendientes" y "Próximos paseos" salían de paseos con fecha de este mes
 *   HASTA HOY, así que una solicitud para mañana nunca aparecía. Ahora salen de
 *   la misma cola que Solicitudes.
 * - "Ingresos del mes" mostraba siempre "—": los paseos no traen precio.
 * - Se leían hasta 100 perfiles de familia para un conteo que no se mostraba.
 * - Los accesos rápidos repetían el menú y se saltaban lo que Configuración →
 *   Paneles oculta, también a un supervisor.
 */
export default function AdminDashboard() {
  const today = new Date().toLocaleDateString('en-CA')
  const queue = useRequestedWalkSessions()
  const { reservations, loading: sessionsLoading } = useCanonicalReservations({
    fromDate: monthStart(today),
    toDate: today,
  })

  const day = useMemo(() => summarizeDay(reservations, today), [reservations, today])
  // Quiénes están en la calle en este momento. Sale de los mismos paseos que
  // ya se leyeron para las cifras: no cuesta una consulta más.
  const onTheStreet = useMemo(() => walksOnTheStreet(reservations, today), [reservations, today])
  const ordered = useMemo(() => orderDispatchQueue(queue.sessions), [queue.sessions])
  const overdue = ordered.filter((session) => dispatchUrgency(session.scheduledDate, today) === 'overdue').length

  const statCards = [
    { label: 'Paseos hoy', value: day.today, icon: CalendarDays, color: '#D97706' },
    { label: 'Completados hoy', value: day.completedToday, icon: CheckCircle2, color: '#059669' },
    { label: 'Paseos del mes', value: day.monthToDate, icon: Dog, color: '#0F766E' },
  ]

  return (
    <div className="animate-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Resumen</h1>
        <p className="mt-1 text-sm text-muted">
          {sessionsLoading ? 'Consultando el día…' : day.today > 0
            ? `${day.today} paseo${day.today !== 1 ? 's' : ''} en marcha para hoy`
            : 'Sin paseos en marcha para hoy'}
        </p>
      </div>

      <PushNudge message="Entérate en cuanto entre una solicitud nueva, aunque tengas la app cerrada." />

      <DataCard
        title="Por asignar"
        action={(
          <Link href="/admin/reservas" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Asignar <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      >
        {queue.loading ? (
          <LoadingState rows={2} height="h-12" />
        ) : queue.error ? (
          <p className="text-sm text-red-700" role="alert">No pudimos consultar las solicitudes. Ábrelas desde Solicitudes y paseos.</p>
        ) : ordered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={22} />}
            title="Todo asignado"
            description="Cuando una familia pida un paseo, aparecerá aquí."
          />
        ) : (
          <div className="space-y-3">
            <p className="flex flex-wrap gap-2 text-sm">
              <span className="font-semibold text-ink">{ordered.length} sin paseador</span>
              {overdue > 0 && <span className="rounded-full bg-danger-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-700">{overdue} con fecha pasada</span>}
            </p>
            <ul className="animate-enter-list space-y-2">
              {ordered.slice(0, 3).map((session) => {
                const urgency = dispatchUrgency(session.scheduledDate, today)
                return (
                  <li key={session.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{SERVICE_NAMES.get(session.serviceId) || session.serviceId}</p>
                      <p className="text-xs text-muted">
                        {session.scheduledDate ? whenLabel(session.scheduledDate, today) : 'Sin fecha'}
                        {session.scheduledStart ? ` · ${session.scheduledStart}` : ''}
                        {` · ${session.dogIds.length} perro${session.dogIds.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${URGENCY_STYLES[urgency]}`}>{URGENCY_LABELS[urgency]}</span>
                  </li>
                )
              })}
            </ul>
            {ordered.length > 3 && (
              <p className="text-xs text-muted">Y {ordered.length - 3} más en Solicitudes y paseos.</p>
            )}
          </div>
        )}
      </DataCard>

      {/* El Resumen contaba los paseos de hoy y no decía cuáles. Quien opera
          necesita ver los que ya salieron, quién los lleva y en qué van. */}
      {onTheStreet.length > 0 && (
        <DataCard
          title="En la calle ahora"
          action={(
            <Link href="/admin/rutas" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Ver en el mapa <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        >
          <ul className="animate-enter-list space-y-2">
            {onTheStreet.map((walk) => (
              <li key={walk.id} className="flex items-center gap-3 rounded-xl border border-ink/10 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success-500/10 text-success-600" aria-hidden="true">
                  <Footprints size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {walk.petName || walk.service}
                    {walk.walkerName && <span className="font-normal text-muted"> · {walk.walkerName}</span>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {walk.time || 'Sin hora'}{walk.name ? ` · ${walk.name}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[walk.status]?.bg || 'bg-ink/10'} ${STATUS_COLORS[walk.status]?.text || 'text-muted'}`}>
                  {STATUS_LABELS[walk.status] || walk.status}
                </span>
              </li>
            ))}
          </ul>
        </DataCard>
      )}

      {/* Tres cifras en una fila que cabe en un teléfono; las tarjetas grandes
          partían "Completados hoy" en dos renglones. */}
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-ink/10 bg-surface p-3 sm:p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <Icon size={14} aria-hidden="true" style={{ color: stat.color }} /> {stat.label}
              </dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">{sessionsLoading ? '—' : stat.value}</dd>
            </div>
          )
        })}
      </dl>

      <AdminWalkerStatus />
    </div>
  )
}
