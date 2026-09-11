'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Banknote, Bot, CalendarDays, Dog, Lightbulb } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import Card from '@/components/ui/Card'
import { usePrices } from '@/context/PricesContext'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { useCanonicalDirectory } from '@/lib/useCanonicalDirectory'
import { canonicalReadErrorMessage, useCanonicalAddressZones } from '@/lib/useCanonicalWalkSessions'
import { formatMxn } from '@/lib/businessMetrics'
import { mexicoCityToday } from '@/lib/customerSegments'
import { useOpenGeofenceAlerts, useSubmittedReportIds } from '@/lib/useInsightSignals'
import {
  INSIGHT_CATEGORY_LABELS,
  INSIGHT_CATEGORY_ORDER,
  computeInsights,
  reportCheckSessionIds,
  type InsightCategory,
  type InsightPriority,
} from '@/lib/insights'

/**
 * Centro de Insights sobre los paseos reales.
 *
 * The rules live in src/lib/insights.ts; this page only gathers the data --
 * walks (read in pages the Firestore rules accept), families and dogs, tariffs,
 * open zone alerts and which recent walks have a sent report -- and shows each
 * insight with the walks, families or dogs it is about.
 */

const MAX_SESSIONS = 500
const MAX_ADDRESS_LOOKUPS = 60

type Period = '7d' | '30d' | '90d'

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 }

const PRIORITY_STYLE: Record<InsightPriority, { badge: string | null; icon: string }> = {
  high: { badge: 'Urgente', icon: 'bg-danger-500/10 text-red-700' },
  medium: { badge: 'Atención', icon: 'bg-warning-500/15 text-amber-800' },
  low: { badge: null, icon: 'bg-primary/10 text-primary' },
}

export default function AdminIAPage() {
  const { reservations, loading, error, retry } = useCanonicalReservations({ max: MAX_SESSIONS })
  const { customers, dogs, loading: directoryLoading, error: directoryError, retry: retryDirectory } = useCanonicalDirectory()
  const { services, status: pricesStatus } = usePrices()
  const [period, setPeriod] = useState<Period>('30d')
  const [category, setCategory] = useState<InsightCategory | 'all'>('all')
  const today = mexicoCityToday()

  const reportIds = useMemo(() => reportCheckSessionIds(reservations, today), [reservations, today])
  const submittedReportIds = useSubmittedReportIds(reportIds)
  const openGeofenceAlerts = useOpenGeofenceAlerts()
  // Cada dirección se lee de a diez por consulta; con este tope son seis.
  const addressIds = useMemo(
    () => Array.from(new Set(reservations.map((session) => session.addressId).filter(Boolean))).slice(0, MAX_ADDRESS_LOOKUPS),
    [reservations],
  )
  const { zonesByAddress } = useCanonicalAddressZones(addressIds)
  const zonesKnown = Object.keys(zonesByAddress).length > 0 ? zonesByAddress : null

  const { metrics, insights, plans, zones } = useMemo(() => computeInsights({
    sessions: reservations,
    customers,
    dogs,
    services,
    pricesLoaded: pricesStatus !== 'loading',
    submittedReportIds,
    openGeofenceAlerts,
    zonesByAddress: zonesKnown,
    today,
    periodDays: PERIOD_DAYS[period],
  }), [reservations, customers, dogs, services, pricesStatus, submittedReportIds, openGeofenceAlerts, zonesKnown, today, period])

  const countByCategory = useMemo(() => {
    const counts = Object.fromEntries(INSIGHT_CATEGORY_ORDER.map((key) => [key, 0])) as Record<InsightCategory, number>
    insights.forEach((insight) => { counts[insight.category] += 1 })
    return counts
  }, [insights])

  const visible = category === 'all' ? insights : insights.filter((insight) => insight.category === category)
  const urgent = insights.filter((insight) => insight.priority === 'high').length
  const readError = error ?? directoryError
  const truncated = reservations.length >= MAX_SESSIONS

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
        description={urgent > 0
          ? `${insights.length} señales · ${urgent} urgente${urgent === 1 ? '' : 's'}`
          : 'Alertas y patrones detectados en los paseos registrados'}
        icon={<Bot size={20} className="text-primary" />}
        actions={(Object.keys(PERIOD_DAYS) as Period[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={period === key}
            onClick={() => setPeriod(key)}
            className={`min-h-9 rounded-full px-4 text-xs font-medium transition-colors ${period === key ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-muted hover:text-ink'}`}
          >
            {PERIOD_DAYS[key]} días
          </button>
        ))}
      />

      {readError ? (
        <Card className="p-4 shadow-none">
          <ErrorState description={canonicalReadErrorMessage(readError)} onRetry={() => { retry(); retryDirectory() }} />
        </Card>
      ) : loading || directoryLoading ? (
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
          {truncated && (
            <p className="text-xs text-muted">Se analizan los {MAX_SESSIONS} paseos más recientes.</p>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Lightbulb size={15} className="text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Insights</h2>
              <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Filtrar por tema">
                {(['all', ...INSIGHT_CATEGORY_ORDER] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={category === key}
                    onClick={() => setCategory(key)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${category === key ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-muted hover:text-ink'}`}
                  >
                    {key === 'all' ? `Todos · ${insights.length}` : `${INSIGHT_CATEGORY_LABELS[key]} · ${countByCategory[key]}`}
                  </button>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              <Card className="p-8 text-center shadow-none">
                <Bot className="mx-auto mb-3 text-muted" aria-hidden="true" />
                <p className="text-sm text-muted">
                  {category === 'all' ? 'Nada que requiera atención en este periodo.' : `Nada de ${INSIGHT_CATEGORY_LABELS[category].toLowerCase()} que requiera atención.`}
                </p>
              </Card>
            ) : (
              <ul className="space-y-2">
                {visible.map((insight) => {
                  const style = PRIORITY_STYLE[insight.priority]
                  return (
                    <li key={insight.id}>
                      <Card className="flex items-start gap-3 p-4 shadow-none">
                        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${style.icon}`}>
                          <Lightbulb size={16} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink">{insight.title}</p>
                            {style.badge && (
                              <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${style.icon}`}>{style.badge}</span>
                            )}
                            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-2xs text-muted">{INSIGHT_CATEGORY_LABELS[insight.category]}</span>
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted">{insight.description}</p>
                          {insight.items.length > 0 && (
                            <ul className="mt-2 space-y-1 border-l-2 border-ink/10 pl-3">
                              {insight.items.map((item, index) => (
                                <li key={`${item.label}-${index}`} className="text-xs">
                                  <span className="font-medium text-ink">{item.label}</span>
                                  {item.detail && <span className="text-muted"> · {item.detail}</span>}
                                </li>
                              ))}
                              {insight.more > 0 && <li className="text-2xs text-muted">y {insight.more} más</li>}
                            </ul>
                          )}
                          {insight.action && (
                            <Link
                              href={insight.action.href}
                              className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              {insight.action.label} <ArrowRight size={12} aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                      </Card>
                    </li>
                  )
                })}
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
          {zones.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-ink">Demanda por zona</h2>
              <Card className="overflow-x-auto p-0 shadow-none">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead className="text-2xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Zona</th>
                      <th className="px-4 py-2 text-right font-medium">Paseos</th>
                      <th className="px-4 py-2 text-right font-medium">Completados</th>
                      <th className="px-4 py-2 text-right font-medium">Cancelados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/[0.06]">
                    {zones.map((zone) => (
                      <tr key={zone.zone}>
                        <td className="px-4 py-3 font-medium text-ink">{zone.zone}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink">{zone.walks}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink">{zone.completed}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink">{zone.cancelled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <p className="mt-2 text-xs text-muted">
                La zona sale de la dirección de cada paseo. Se leen hasta {MAX_ADDRESS_LOOKUPS} direcciones distintas: las demás aparecen como zona desconocida.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
