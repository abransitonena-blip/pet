'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Banknote, Bot, CalendarDays,
  Clock, Dog, Lightbulb, PersonStanding, Star, Tag, Users, Zap,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import Card from '@/components/ui/Card'
import { usePrices } from '@/context/PricesContext'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import {
  CANCELLED_STATUSES,
  COMPLETED_STATUSES,
  UNASSIGNED_STATUSES,
  formatMxn,
  growthPercent,
  localDateDaysAgo,
  offeredPlansWithoutPrice,
  totalValue,
  valueSessions,
} from '@/lib/businessMetrics'

/**
 * Centro de Insights sobre los paseos reales.
 *
 * Every rule here used to run over the legacy `reservations` collection, so
 * it had nothing to say. It now runs over the canonical sessions; walker load
 * comes from the sessions themselves, and the old margin table is gone because
 * canonical walks record no discount -- a discount column would be invented.
 */

interface Insight {
  id: string
  title: string
  description: string
  icon: typeof Bot
  priority: 'high' | 'medium' | 'low'
  action?: string
  actionHref?: string
}

type Period = '7d' | '30d' | '90d'

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 }
const WEEKDAY_BY_INDEX = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const OVERLOAD_THRESHOLD = 6
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

export default function AdminIAPage() {
  const router = useRouter()
  const { reservations, loading, error, retry } = useCanonicalReservations({ max: 500 })
  const { services } = usePrices()
  const [period, setPeriod] = useState<Period>('30d')

  const { metrics, insights, plans } = useMemo(() => {
    const valued = valueSessions(reservations, services)
    const days = PERIOD_DAYS[period]
    const today = localDateDaysAgo(0)
    const start = localDateDaysAgo(days - 1)
    const previousStart = localDateDaysAgo(days * 2 - 1)

    const inPeriod = valued.filter((session) => session.date >= start && session.date <= today)
    const inPrevious = valued.filter((session) => session.date >= previousStart && session.date < start)
    const completed = inPeriod.filter((session) => COMPLETED_STATUSES.has(session.status))
    const value = totalValue(completed)
    const previousValue = totalValue(inPrevious.filter((session) => COMPLETED_STATUSES.has(session.status)))
    const cancelled = inPeriod.filter((session) => CANCELLED_STATUSES.has(session.status)).length
    const cancelRate = inPeriod.length > 0 ? Math.round((cancelled / inPeriod.length) * 100) : 0
    const active = inPeriod.filter((session) => !CANCELLED_STATUSES.has(session.status))

    const result: Insight[] = []

    const unassignedToday = valued.filter((session) => session.date === today && UNASSIGNED_STATUSES.has(session.status))
    if (unassignedToday.length > 0) {
      result.push({
        id: 'unassigned-today',
        title: `${unassignedToday.length} paseo${unassignedToday.length === 1 ? '' : 's'} de hoy sin paseador`,
        description: 'Tienen fecha de hoy y todavía nadie los ha tomado. Asígnalos antes de la ventana de llegada.',
        icon: AlertTriangle,
        priority: 'high',
        action: 'Ir a solicitudes',
        actionHref: '/admin/reservas',
      })
    }

    const weekAhead = localDateDaysAgo(-7)
    const unassignedSoon = valued.filter((session) => session.date > today && session.date <= weekAhead && UNASSIGNED_STATUSES.has(session.status))
    if (unassignedSoon.length > 0) {
      result.push({
        id: 'unassigned-week',
        title: `${unassignedSoon.length} paseo${unassignedSoon.length === 1 ? '' : 's'} de la próxima semana sin paseador`,
        description: 'Asignarlos con anticipación deja margen para reprogramar si nadie está disponible.',
        icon: CalendarDays,
        priority: 'medium',
        action: 'Ir a solicitudes',
        actionHref: '/admin/reservas',
      })
    }

    const missing = offeredPlansWithoutPrice(services)
    if (missing.length > 0) {
      result.push({
        id: 'missing-prices',
        title: `Falta tarifa: ${missing.join(', ')}`,
        description: 'Las familias no pueden reservar un plan sin tarifa publicada, y sus paseos no suman valor.',
        icon: Tag,
        priority: 'high',
        action: 'Configurar precios',
        actionHref: '/admin/config',
      })
    }

    const valueGrowth = growthPercent(value.cents, previousValue.cents)
    if (valueGrowth !== null && valueGrowth >= 10) {
      result.push({ id: 'value-up', title: 'Valor completado en alza', description: `Subió ${valueGrowth}% frente al periodo anterior del mismo largo.`, icon: ArrowUp, priority: 'low' })
    } else if (valueGrowth !== null && valueGrowth <= -10) {
      result.push({
        id: 'value-down',
        title: 'Valor completado a la baja',
        description: `Bajó ${Math.abs(valueGrowth)}% frente al periodo anterior del mismo largo.`,
        icon: ArrowDown,
        priority: 'high',
        action: 'Crear un cupón',
        actionHref: '/admin/cupones',
      })
    }

    const walkerLoads = new Map<string, { name: string; today: number }>()
    for (const session of valued) {
      if (session.date !== today || !session.assignedWalker || CANCELLED_STATUSES.has(session.status)) continue
      const entry = walkerLoads.get(session.assignedWalker) ?? { name: session.walkerName || 'Paseador sin nombre', today: 0 }
      entry.today += 1
      walkerLoads.set(session.assignedWalker, entry)
    }
    const overloaded = Array.from(walkerLoads.values()).filter((walker) => walker.today > OVERLOAD_THRESHOLD)
    if (overloaded.length > 0) {
      result.push({
        id: 'overloaded',
        title: 'Paseadores con carga alta hoy',
        description: `${overloaded.map((walker) => `${walker.name} (${walker.today})`).join(', ')} tienen más de ${OVERLOAD_THRESHOLD} paseos hoy.`,
        icon: PersonStanding,
        priority: 'high',
        action: 'Ver paseadores',
        actionHref: '/admin/paseadores',
      })
    }

    if (inPeriod.length >= 5 && cancelRate > 15) {
      result.push({ id: 'cancel-rate', title: `${cancelRate}% de cancelaciones`, description: 'Revisa si se concentran en un plan, horario o zona.', icon: AlertTriangle, priority: 'medium' })
    }

    const weekdayCounts = new Map<string, number>()
    const hourCounts = new Map<string, number>()
    const planCounts = new Map<string, number>()
    for (const session of active) {
      const weekday = WEEKDAY_BY_INDEX[new Date(`${session.date}T12:00:00`).getDay()]
      weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1)
      const hour = (session.arrivalWindowStart || session.time || '').split(':')[0]
      if (hour) hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
      planCounts.set(session.service, (planCounts.get(session.service) ?? 0) + 1)
    }
    const top = (counts: Map<string, number>) => Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]
    const peakDay = top(weekdayCounts)
    const peakHour = top(hourCounts)
    const topPlan = top(planCounts)
    if (peakDay && active.length >= 5) {
      result.push({ id: 'peak-day', title: `Día más demandado: ${peakDay[0]}`, description: `Concentra ${peakDay[1]} de ${active.length} paseos del periodo. Asegura paseadores disponibles ese día.`, icon: CalendarDays, priority: 'medium' })
    }
    if (peakHour && active.length >= 5) {
      result.push({ id: 'peak-hour', title: `Hora pico: ${peakHour[0]}:00`, description: `${peakHour[1]} paseos empiezan a esa hora. Úsalo para planear disponibilidad.`, icon: Clock, priority: 'medium' })
    }
    if (topPlan && active.length >= 5) {
      result.push({ id: 'top-plan', title: `Plan más reservado: ${topPlan[0]}`, description: `Representa ${Math.round((topPlan[1] / active.length) * 100)}% de los paseos del periodo.`, icon: Zap, priority: 'low' })
    }

    const walksPerFamily = new Map<string, number>()
    for (const session of valued) {
      if (CANCELLED_STATUSES.has(session.status)) continue
      walksPerFamily.set(session.customerId, (walksPerFamily.get(session.customerId) ?? 0) + 1)
    }
    const families = walksPerFamily.size
    const returning = Array.from(walksPerFamily.values()).filter((count) => count > 1).length
    const retention = families > 0 ? Math.round((returning / families) * 100) : 0
    if (families >= 5 && retention < 30) {
      result.push({ id: 'low-retention', title: 'Pocas familias repiten', description: `Solo ${retention}% de las familias con paseos han vuelto a reservar.`, icon: Users, priority: 'medium' })
    } else if (families >= 5 && retention >= 50) {
      result.push({ id: 'good-retention', title: 'Buena recurrencia', description: `${retention}% de las familias con paseos han vuelto a reservar.`, icon: Star, priority: 'low' })
    }

    const planTable = new Map<string, { name: string; walks: number; completed: number; cents: number }>()
    for (const session of active) {
      const entry = planTable.get(session.serviceId) ?? { name: session.service, walks: 0, completed: 0, cents: 0 }
      entry.walks += 1
      if (COMPLETED_STATUSES.has(session.status)) {
        entry.completed += 1
        if (session.valueCents !== null) entry.cents += session.valueCents
      }
      planTable.set(session.serviceId, entry)
    }

    return {
      metrics: { walks: inPeriod.length, completed: completed.length, value, cancelRate },
      insights: result.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
      plans: Array.from(planTable.values()).sort((a, b) => b.walks - a.walks),
    }
  }, [reservations, services, period])

  const cards = [
    { label: 'Paseos', value: String(metrics.walks), icon: CalendarDays },
    { label: 'Completados', value: String(metrics.completed), icon: Dog },
    { label: 'Valor completado', value: formatMxn(metrics.value.cents), icon: Banknote },
    { label: 'Cancelaciones', value: `${metrics.cancelRate}%`, icon: AlertTriangle },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centro de Insights"
        description="Alertas y patrones detectados en los paseos registrados"
        icon={<Bot size={20} className="text-primary" />}
        actions={(Object.keys(PERIOD_DAYS) as Period[]).map((key) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`min-h-9 rounded-full px-4 text-xs font-medium transition-colors ${period === key ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-muted hover:text-ink'}`}
          >
            {PERIOD_DAYS[key]} días
          </button>
        ))}
      />

      {error ? (
        <Card className="p-4 shadow-none">
          <ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} />
        </Card>
      ) : loading ? (
        <LoadingState rows={3} height="h-24" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map((card) => (
              <Card key={card.label} className="p-4 shadow-none">
                <card.icon size={15} className="mb-2 text-primary" aria-hidden="true" />
                <dd className="text-xl font-bold tabular-nums text-ink">{card.value}</dd>
                <dt className="mt-0.5 text-2xs text-muted">{card.label}</dt>
              </Card>
            ))}
          </dl>
          {metrics.value.unknown > 0 && (
            <p className="text-xs text-muted">
              {metrics.value.unknown} paseo{metrics.value.unknown === 1 ? '' : 's'} completado{metrics.value.unknown === 1 ? '' : 's'} con una tarifa anterior no suma{metrics.value.unknown === 1 ? '' : 'n'} valor.
            </p>
          )}

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb size={15} className="text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Insights</h2>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-2xs text-muted">{insights.length}</span>
            </div>
            {insights.length === 0 ? (
              <Card className="p-8 text-center shadow-none">
                <Bot className="mx-auto mb-3 text-muted" aria-hidden="true" />
                <p className="text-sm text-muted">Nada que requiera atención en este periodo.</p>
              </Card>
            ) : (
              <ul className="space-y-2">
                {insights.map((insight) => (
                  <li key={insight.id}>
                    <Card className="flex items-start gap-3 p-4 shadow-none">
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${insight.priority === 'high' ? 'bg-danger-500/10 text-red-700' : 'bg-primary/10 text-primary'}`}>
                        <insight.icon size={16} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink">{insight.title}</p>
                          {insight.priority === 'high' && <span className="rounded-full bg-danger-500/10 px-2 py-0.5 text-2xs font-medium text-red-700">Urgente</span>}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{insight.description}</p>
                        {insight.action && insight.actionHref && (
                          <button
                            onClick={() => router.push(insight.actionHref as string)}
                            className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            {insight.action} <ArrowRight size={12} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {plans.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-ink">Valor por plan</h2>
              <Card className="overflow-x-auto p-0 shadow-none">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="text-2xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Plan</th>
                      <th className="px-4 py-2 text-right font-medium">Paseos</th>
                      <th className="px-4 py-2 text-right font-medium">Completados</th>
                      <th className="px-4 py-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/[0.06]">
                    {plans.map((plan) => (
                      <tr key={plan.name}>
                        <td className="px-4 py-3 font-medium text-ink">{plan.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink">{plan.walks}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink">{plan.completed}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink">{formatMxn(plan.cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  )
}
