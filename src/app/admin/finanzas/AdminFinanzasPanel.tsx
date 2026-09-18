'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import Card from '@/components/ui/Card'
import DataCard from '@/components/ui/DataCard'
import Button from '@/components/ui/Button'
import { usePrices } from '@/context/PricesContext'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import {
  CANCELLED_STATUSES,
  COMPLETED_STATUSES,
  STATUS_LABELS,
  UPCOMING_STATUSES,
  formatMxn,
  localDateDaysAgo,
  offeredPlansWithoutPrice,
  totalValue,
  valueSessions,
} from '@/lib/businessMetrics'

/**
 * Finanzas sobre los paseos reales.
 *
 * This page summed the legacy `reservations` collection, which nothing writes
 * to anymore, so it read $0 with bookings in the system. It now reads the
 * canonical sessions and values each one through businessMetrics.ts, which
 * never re-prices a walk booked on an older tariff at today's price.
 */

type Preset = 'today' | 'week' | 'month' | 'year' | 'custom'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: '7 días' },
  { key: 'month', label: '30 días' },
  { key: 'year', label: 'Año' },
  { key: 'custom', label: 'Rango' },
]

const PRESET_DAYS: Record<Exclude<Preset, 'custom'>, number> = { today: 0, week: 6, month: 29, year: 364 }
const TABLE_ROWS = 25

/** Spreadsheet apps run a cell that starts with = + - @ as a formula. */
function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export default function AdminFinanzasPage() {
  const { reservations, loading, error, retry } = useCanonicalReservations({ max: 500 })
  const { services } = usePrices()
  const [preset, setPreset] = useState<Preset>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const valued = useMemo(() => valueSessions(reservations, services), [reservations, services])
  const missingPrices = useMemo(() => offeredPlansWithoutPrice(services), [services])

  const filtered = useMemo(() => {
    if (preset === 'custom') {
      return valued.filter((session) => (!dateFrom || session.date >= dateFrom) && (!dateTo || session.date <= dateTo))
    }
    const today = localDateDaysAgo(0)
    const from = localDateDaysAgo(PRESET_DAYS[preset])
    // The last N days plus everything already booked ahead: upcoming walks are
    // exactly what "por realizar" measures. "Hoy" means today only.
    return valued.filter((session) => session.date >= from && (preset !== 'today' || session.date === today))
  }, [valued, preset, dateFrom, dateTo])

  const stats = useMemo(() => {
    const completed = filtered.filter((session) => COMPLETED_STATUSES.has(session.status))
    const upcoming = filtered.filter((session) => UPCOMING_STATUSES.has(session.status))
    const completedValue = totalValue(completed)
    return {
      completed: completed.length,
      upcoming: upcoming.length,
      cancelled: filtered.filter((session) => CANCELLED_STATUSES.has(session.status)).length,
      completedValue,
      upcomingValue: totalValue(upcoming),
      averageCents: completedValue.counted > 0 ? Math.round(completedValue.cents / completedValue.counted) : null,
    }
  }, [filtered])

  const daily = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = localDateDaysAgo(13 - index)
      return { date, label: `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`, cents: 0, count: 0 }
    })
    const byDate = new Map(days.map((day) => [day.date, day]))
    for (const session of valued) {
      if (!COMPLETED_STATUSES.has(session.status)) continue
      const day = byDate.get(session.date)
      if (!day) continue
      day.count += 1
      if (session.valueCents !== null) day.cents += session.valueCents
    }
    return days
  }, [valued])
  const maxDaily = Math.max(...daily.map((day) => day.cents), 1)

  const byPlan = useMemo(() => {
    const plans = new Map<string, { name: string; walks: number; completed: number; cents: number }>()
    for (const session of filtered) {
      if (CANCELLED_STATUSES.has(session.status)) continue
      const entry = plans.get(session.serviceId) ?? { name: session.service, walks: 0, completed: 0, cents: 0 }
      entry.walks += 1
      if (COMPLETED_STATUSES.has(session.status)) {
        entry.completed += 1
        if (session.valueCents !== null) entry.cents += session.valueCents
      }
      plans.set(session.serviceId, entry)
    }
    return Array.from(plans.values()).sort((a, b) => b.walks - a.walks)
  }, [filtered])

  const latest = useMemo(
    () => [...filtered].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, TABLE_ROWS),
    [filtered],
  )

  const exportCsv = () => {
    const header = ['Fecha', 'Hora', 'Familia', 'Mascota', 'Plan', 'Estado', 'Valor MXN', 'Paseador']
    const rows = filtered.map((session) => [
      session.date,
      session.time,
      session.name,
      session.petName,
      session.service,
      STATUS_LABELS[session.status] ?? session.status,
      session.valueCents === null ? '' : (session.valueCents / 100).toFixed(2),
      session.walkerName,
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => csvCell(String(cell ?? ''))).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `finanzas-${localDateDaysAgo(0)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const kpis = [
    {
      label: 'Valor completado',
      value: formatMxn(stats.completedValue.cents),
      note: stats.completedValue.unknown > 0
        ? `${stats.completedValue.unknown} paseo${stats.completedValue.unknown === 1 ? '' : 's'} con tarifa anterior no suma${stats.completedValue.unknown === 1 ? '' : 'n'}`
        : `${stats.completed} paseo${stats.completed === 1 ? '' : 's'} completado${stats.completed === 1 ? '' : 's'}`,
    },
    {
      label: 'Por realizar',
      value: formatMxn(stats.upcomingValue.cents),
      note: `${stats.upcoming} paseo${stats.upcoming === 1 ? '' : 's'} próximo${stats.upcoming === 1 ? '' : 's'} o en curso`,
    },
    {
      label: 'Cobrado',
      value: '—',
      note: FEATURE_FLAGS.FINANCE_PAYMENTS_ENABLED
        ? 'Consulta los pagos registrados en Etiquetas internas'
        : 'El registro de pagos todavía no está activo',
    },
    {
      label: 'Ticket promedio',
      value: stats.averageCents === null ? '—' : formatMxn(stats.averageCents),
      note: 'Por paseo completado',
    },
    { label: 'Completados', value: String(stats.completed), note: 'En el periodo' },
    { label: 'Cancelados', value: String(stats.cancelled), note: 'En el periodo' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        description="Valor de los paseos según la tarifa con la que se reservaron"
        actions={(
          <Button size="sm" variant="secondary" onClick={exportCsv} disabled={filtered.length === 0} leftIcon={<Download size={12} />}>
            Exportar CSV
          </Button>
        )}
      />

      {missingPrices.length > 0 && (
        <p role="alert" className="rounded-2xl bg-warning/10 px-4 py-3 text-sm text-amber-900">
          Falta publicar la tarifa de: {missingPrices.join(', ')}. Esos paseos no suman valor hasta que la configures en Configuración → Precios de servicios.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            onClick={() => setPreset(item.key)}
            className={`min-h-9 rounded-full px-4 text-xs font-medium transition-colors ${preset === item.key ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-muted hover:text-ink'}`}
          >
            {item.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex flex-wrap gap-2">
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="input-field !w-auto text-xs" aria-label="Desde" />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="input-field !w-auto text-xs" aria-label="Hasta" />
          </div>
        )}
      </div>

      {error ? (
        <Card className="p-4 shadow-none">
          <ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} />
        </Card>
      ) : loading ? (
        <LoadingState rows={3} height="h-28" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="p-4 shadow-none">
                <dt className="text-xs text-muted">{kpi.label}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">{kpi.value}</dd>
                <p className="mt-0.5 text-2xs text-muted">{kpi.note}</p>
              </Card>
            ))}
          </dl>

          <DataCard title="Valor completado por día (últimos 14 días)">
            <div className="flex h-36 items-end gap-1">
              {daily.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="min-h-[2px] w-full rounded-t-md bg-primary/60 transition-colors hover:bg-primary"
                    style={{ height: `${(day.cents / maxDaily) * 100}%` }}
                    title={`${day.label}: ${formatMxn(day.cents)} · ${day.count} paseo${day.count === 1 ? '' : 's'}`}
                  />
                  <span className="text-2xs text-muted">{day.label}</span>
                </div>
              ))}
            </div>
          </DataCard>

          {byPlan.length > 0 && (
            <DataCard title="Por plan (en el periodo)">
              <div className="space-y-3">
                {byPlan.map((plan) => (
                  <div key={plan.name}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-ink">{plan.name}</span>
                      <span className="tabular-nums text-muted">{plan.walks} paseos · {plan.completed} completados · {formatMxn(plan.cents)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink/5">
                      <div className="h-full rounded-full bg-primary/50" style={{ width: `${(plan.walks / byPlan[0].walks) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </DataCard>
          )}

          <DataCard title={`Paseos del periodo${filtered.length > TABLE_ROWS ? ` (${TABLE_ROWS} más recientes de ${filtered.length})` : ''}`}>
            {latest.length === 0 ? (
              <p className="text-sm text-muted">No hay paseos en este periodo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-2xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Fecha</th>
                      <th className="py-2 pr-3 font-medium">Familia</th>
                      <th className="py-2 pr-3 font-medium">Mascota</th>
                      <th className="py-2 pr-3 font-medium">Plan</th>
                      <th className="py-2 pr-3 font-medium">Estado</th>
                      <th className="py-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/[0.06]">
                    {latest.map((session) => (
                      <tr key={session.id}>
                        <td className="py-2 pr-3 tabular-nums text-ink">{session.date} {session.time}</td>
                        <td className="py-2 pr-3 text-ink">{session.name || '—'}</td>
                        <td className="py-2 pr-3 text-ink">{session.petName || '—'}</td>
                        <td className="py-2 pr-3 text-ink">{session.service}</td>
                        <td className="py-2 pr-3 text-muted">{STATUS_LABELS[session.status] ?? session.status}</td>
                        <td className="py-2 text-right tabular-nums text-ink">
                          {session.valueCents === null ? <span className="text-muted">Sin tarifa vigente</span> : formatMxn(session.valueCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </>
      )}

      <p className="text-xs text-muted">
        Cada paseo se valora con la tarifa publicada de su plan, siempre que se haya reservado con esa misma versión. Los
        reservados con una tarifa anterior aparecen como «Sin tarifa vigente» y no se re-cotizan al precio de hoy.
        «Cobrado» empezará a sumar cuando se active el registro de pagos.
      </p>
    </div>
  )
}
