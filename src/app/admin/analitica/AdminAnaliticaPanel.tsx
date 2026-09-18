'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Banknote, CalendarDays, PersonStanding, Star, Users } from 'lucide-react'
import { db } from '@/firebase/db'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import Card from '@/components/ui/Card'
import { usePrices } from '@/context/PricesContext'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { useCanonicalDirectory } from '@/lib/useCanonicalDirectory'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import {
  CANCELLED_STATUSES,
  COMPLETED_STATUSES,
  formatMxn,
  growthPercent,
  localDateDaysAgo,
  totalValue,
  valueSessions,
} from '@/lib/businessMetrics'

/**
 * Analítica sobre los paseos reales.
 *
 * Like Finanzas, this read the legacy `reservations` collection and showed
 * zeros; it now reads the canonical sessions (the 500 most recent), values
 * them through businessMetrics.ts, counts new families by the date their
 * account was created, and ranks walkers from the sessions themselves
 * instead of the retired walker list in the site config.
 */

interface Review {
  id: string
  rating: number
}

const WEEKDAY_BY_INDEX = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const WEEKDAY_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MAX_SESSIONS = 500

function trend(growth: number | null): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (growth === null) return { text: 'Sin periodo anterior para comparar', tone: 'flat' }
  if (growth === 0) return { text: 'Igual que los 30 días previos', tone: 'flat' }
  return { text: `${growth > 0 ? '+' : ''}${growth}% vs. los 30 días previos`, tone: growth > 0 ? 'up' : 'down' }
}

export default function AdminAnaliticaPage() {
  const { reservations, loading, error, retry } = useCanonicalReservations({ max: MAX_SESSIONS })
  const { customers } = useCanonicalDirectory()
  const { services } = usePrices()
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => {
    const reviewsQuery = query(collection(db, 'reviews'), orderBy('date', 'desc'), limit(50))
    return onSnapshot(reviewsQuery, (snapshot) => {
      setReviews(snapshot.docs.map((item) => ({ id: item.id, rating: Number(item.data().rating) || 0 })))
    }, () => setReviews([]))
  }, [])

  const analytics = useMemo(() => {
    const valued = valueSessions(reservations, services)
    const active = valued.filter((session) => !CANCELLED_STATUSES.has(session.status))
    const today = localDateDaysAgo(0)
    const start = localDateDaysAgo(29)
    const previousStart = localDateDaysAgo(59)
    const previousEnd = localDateDaysAgo(30)

    const current = active.filter((session) => session.date >= start && session.date <= today)
    const previous = active.filter((session) => session.date >= previousStart && session.date <= previousEnd)
    const currentValue = totalValue(current.filter((session) => COMPLETED_STATUSES.has(session.status)))
    const previousValue = totalValue(previous.filter((session) => COMPLETED_STATUSES.has(session.status)))

    const startMs = new Date(`${start}T00:00:00`).getTime()
    const previousStartMs = new Date(`${previousStart}T00:00:00`).getTime()
    const createdMs = (createdAt: { seconds: number } | null) => (createdAt ? createdAt.seconds * 1000 : null)
    const newFamilies = customers.filter((customer) => {
      const ms = createdMs(customer.createdAt)
      return ms !== null && ms >= startMs
    }).length
    const previousFamilies = customers.filter((customer) => {
      const ms = createdMs(customer.createdAt)
      return ms !== null && ms >= previousStartMs && ms < startMs
    }).length

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setDate(1)
      date.setMonth(date.getMonth() - (5 - index))
      const label = date.toLocaleDateString('es-MX', { month: 'short' })
      return { key: date.toLocaleDateString('en-CA').slice(0, 7), label: label.charAt(0).toUpperCase() + label.slice(1), cents: 0, walks: 0 }
    })
    const monthByKey = new Map(months.map((month) => [month.key, month]))
    for (const session of valued) {
      if (!COMPLETED_STATUSES.has(session.status)) continue
      const month = monthByKey.get(session.date.slice(0, 7))
      if (!month) continue
      month.walks += 1
      if (session.valueCents !== null) month.cents += session.valueCents
    }

    const walksPerFamily = new Map<string, number>()
    for (const session of active) walksPerFamily.set(session.customerId, (walksPerFamily.get(session.customerId) ?? 0) + 1)
    const familiesWithWalks = walksPerFamily.size
    const returningFamilies = Array.from(walksPerFamily.values()).filter((count) => count > 1).length

    const plans = new Map<string, { name: string; walks: number; cents: number }>()
    for (const session of current) {
      const entry = plans.get(session.serviceId) ?? { name: session.service, walks: 0, cents: 0 }
      entry.walks += 1
      if (COMPLETED_STATUSES.has(session.status) && session.valueCents !== null) entry.cents += session.valueCents
      plans.set(session.serviceId, entry)
    }

    const weekdays: Record<string, number> = Object.fromEntries(WEEKDAY_ORDER.map((day) => [day, 0]))
    for (const session of active) {
      if (!session.date) continue
      weekdays[WEEKDAY_BY_INDEX[new Date(`${session.date}T12:00:00`).getDay()]] += 1
    }

    const walkers = new Map<string, { name: string; assigned: number; completed: number; cents: number }>()
    for (const session of active) {
      if (!session.assignedWalker) continue
      const entry = walkers.get(session.assignedWalker) ?? { name: session.walkerName || 'Paseador sin nombre', assigned: 0, completed: 0, cents: 0 }
      entry.assigned += 1
      if (COMPLETED_STATUSES.has(session.status)) {
        entry.completed += 1
        if (session.valueCents !== null) entry.cents += session.valueCents
      }
      walkers.set(session.assignedWalker, entry)
    }

    const ratedReviews = reviews.filter((review) => review.rating > 0)
    return {
      walks: current.length,
      walksGrowth: growthPercent(current.length, previous.length),
      value: currentValue,
      valueGrowth: growthPercent(currentValue.cents, previousValue.cents),
      newFamilies,
      familiesGrowth: growthPercent(newFamilies, previousFamilies),
      averageRating: ratedReviews.length > 0 ? ratedReviews.reduce((sum, review) => sum + review.rating, 0) / ratedReviews.length : null,
      reviewCount: ratedReviews.length,
      months,
      maxMonthCents: Math.max(...months.map((month) => month.cents), 1),
      familiesWithWalks,
      returningFamilies,
      plans: Array.from(plans.values()).sort((a, b) => b.walks - a.walks),
      weekdays,
      maxWeekday: Math.max(...Object.values(weekdays), 1),
      walkers: Array.from(walkers.values()).sort((a, b) => b.completed - a.completed || b.assigned - a.assigned),
    }
  }, [reservations, services, customers, reviews])

  const kpis = [
    { label: 'Paseos (30 días)', value: String(analytics.walks), trend: trend(analytics.walksGrowth), icon: CalendarDays },
    {
      label: 'Valor completado (30 días)',
      value: formatMxn(analytics.value.cents),
      trend: analytics.value.unknown > 0
        ? { text: `${analytics.value.unknown} con tarifa anterior no suman`, tone: 'flat' as const }
        : trend(analytics.valueGrowth),
      icon: Banknote,
    },
    { label: 'Familias nuevas (30 días)', value: String(analytics.newFamilies), trend: trend(analytics.familiesGrowth), icon: Users },
    {
      label: 'Calificación',
      value: analytics.averageRating === null ? '—' : `${analytics.averageRating.toFixed(1)} ★`,
      trend: { text: `${analytics.reviewCount} reseña${analytics.reviewCount === 1 ? '' : 's'}`, tone: 'flat' as const },
      icon: Star,
    },
  ]

  const retention = analytics.familiesWithWalks > 0
    ? Math.round((analytics.returningFamilies / analytics.familiesWithWalks) * 100)
    : null

  return (
    <div className="space-y-6">
      <PageHeader title="Analítica" description="Tendencias de los últimos meses, con base en los paseos registrados" />

      {error ? (
        <Card className="p-4 shadow-none">
          <ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} />
        </Card>
      ) : loading ? (
        <LoadingState rows={3} height="h-28" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="p-4 shadow-none">
                <kpi.icon size={15} className="mb-2 text-primary" aria-hidden="true" />
                <dt className="text-xs text-muted">{kpi.label}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">{kpi.value}</dd>
                <p className={`mt-0.5 text-2xs ${kpi.trend.tone === 'up' ? 'text-success-700' : kpi.trend.tone === 'down' ? 'text-red-700' : 'text-muted'}`}>
                  {kpi.trend.text}
                </p>
              </Card>
            ))}
          </dl>

          <Card className="p-4 shadow-none">
            <p className="mb-3 text-sm font-semibold text-ink">Valor completado por mes</p>
            <div className="flex h-40 items-end gap-2">
              {analytics.months.map((month) => (
                <div key={month.key} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-2xs font-medium tabular-nums text-ink">{formatMxn(month.cents)}</span>
                  <div
                    className="min-h-[2px] w-full rounded-t-md bg-success/50"
                    style={{ height: `${(month.cents / analytics.maxMonthCents) * 100}%` }}
                    title={`${month.label}: ${month.walks} paseo${month.walks === 1 ? '' : 's'} completado${month.walks === 1 ? '' : 's'}`}
                  />
                  <span className="text-2xs text-muted">{month.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="p-4 shadow-none">
              <p className="mb-2 text-sm font-semibold text-ink">Familias que repiten</p>
              <p className="text-3xl font-bold tabular-nums text-ink">{retention === null ? '—' : `${retention}%`}</p>
              <p className="mt-1 text-xs text-muted">
                {analytics.returningFamilies} de {analytics.familiesWithWalks} familias con paseos han reservado más de una vez
              </p>
            </Card>

            <Card className="p-4 shadow-none">
              <p className="mb-3 text-sm font-semibold text-ink">Planes (30 días)</p>
              {analytics.plans.length === 0 ? (
                <p className="text-xs text-muted">Sin paseos en los últimos 30 días.</p>
              ) : (
                <div className="space-y-2">
                  {analytics.plans.map((plan) => (
                    <div key={plan.name}>
                      <div className="mb-0.5 flex items-center justify-between text-xs">
                        <span className="text-ink">{plan.name}</span>
                        <span className="tabular-nums text-muted">{plan.walks} · {formatMxn(plan.cents)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink/5">
                        <div className="h-full rounded-full bg-primary/50" style={{ width: `${(plan.walks / analytics.plans[0].walks) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="p-4 shadow-none">
            <p className="mb-3 text-sm font-semibold text-ink">Paseos por día de la semana</p>
            <div className="flex h-32 items-end gap-2">
              {WEEKDAY_ORDER.map((day) => (
                <div key={day} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-2xs tabular-nums text-muted">{analytics.weekdays[day]}</span>
                  <div className="min-h-[2px] w-full rounded-t-md bg-primary/40" style={{ height: `${(analytics.weekdays[day] / analytics.maxWeekday) * 100}%` }} />
                  <span className="text-2xs text-muted">{day}</span>
                </div>
              ))}
            </div>
          </Card>

          {analytics.walkers.length > 0 && (
            <Card className="p-4 shadow-none">
              <div className="mb-3 flex items-center gap-2">
                <PersonStanding size={15} className="text-primary" aria-hidden="true" />
                <p className="text-sm font-semibold text-ink">Paseadores</p>
              </div>
              <div className="space-y-3">
                {analytics.walkers.map((walker) => {
                  const rate = walker.assigned > 0 ? Math.round((walker.completed / walker.assigned) * 100) : 0
                  return (
                    <div key={walker.name}>
                      <div className="mb-0.5 flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-ink">{walker.name}</span>
                        <span className="tabular-nums text-muted">{walker.completed}/{walker.assigned} · {formatMxn(walker.cents)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink/5">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-2xs text-muted">{rate}% de sus paseos asignados, completados</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <p className="text-xs text-muted">
            Calculado sobre los {MAX_SESSIONS} paseos más recientes. Los paseos cancelados no cuentan; los reservados con una
            tarifa anterior se cuentan pero no suman valor.
          </p>
        </>
      )}
    </div>
  )
}
