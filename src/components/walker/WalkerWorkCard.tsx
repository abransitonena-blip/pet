'use client'

import { useMemo } from 'react'
import { CalendarCheck, CalendarDays, CircleSlash, Footprints, TrendingUp } from 'lucide-react'
import Card from '@/components/ui/Card'
import { useWalkerSessions } from '@/lib/useServiceOrders'
import { walkerSessionDate, walkerSessionStatus } from '@/lib/walkerPanel'
import { activeDays, summarizeWalkerWork } from '@/lib/walkerStats'
import { daysAgo } from '@/lib/recentWindow'
import { WALK_WINDOW_MAX_PAGES } from '@/lib/walkWindowQueries'

/**
 * Lo que este paseador ha hecho, contado de sus propios paseos.
 *
 * Su panel le decía qué hacer hoy y nada de lo que ya hizo. Aquí están sus
 * números -- completados, esta semana, este mes, días distintos que salió -- sin
 * puntajes ni medallas: una "puntuación" con fórmula propia se ve bonita y no le
 * dice a nadie qué hacer distinto mañana.
 *
 * Cuenta una ventana de 31 días, no "todo": la consulta pide orden ascendente
 * con tope de 100, así que "todo" eran en realidad los cien paseos MÁS
 * ANTIGUOS -- esta tarjeta los llamaba "los más recientes". Un mes cabe de
 * sobra en el tope para casi cualquier carga; si aun así lo llena, la tarjeta
 * lo dice en vez de enseñar números que no cuadran.
 */

const WINDOW_DAYS = 31

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA')
}

function formatDate(date: string): string {
  if (!date) return '—'
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function WalkerWorkCard({ uid }: { uid: string }) {
  const since = daysAgo(todayKey(), WINDOW_DAYS)
  // Quien sale mucho pasa de cien paseos en 31 días: se siguen leyendo las páginas que faltan.
  const { sessions, loading, loadingMore, capped } = useWalkerSessions(uid, { since, maxPages: WALK_WINDOW_MAX_PAGES })

  const rows = useMemo(
    () => sessions.map((session) => ({ date: walkerSessionDate(session), status: walkerSessionStatus(session) })),
    [sessions],
  )
  const summary = useMemo(() => summarizeWalkerWork(rows, todayKey()), [rows])
  const days = useMemo(() => activeDays(rows), [rows])

  // Con el resto del mes todavía en camino, contar diría "0 esta semana" a quien salió ayer.
  if (loading || loadingMore || rows.length === 0) return null

  const tiles = [
    { label: 'Completados', value: summary.completed, icon: Footprints },
    { label: 'Esta semana', value: summary.completedThisWeek, icon: TrendingUp },
    { label: 'Este mes', value: summary.completedThisMonth, icon: CalendarDays },
    { label: 'Días que saliste', value: days, icon: CalendarCheck },
  ]

  // Si ni con todas las páginas cabe, los paseos que trae son los más viejos de
  // esos 31 días: contar con ellos diría "0 esta semana" a alguien que salió ayer.
  if (capped) {
    return (
      <Card className="p-4 shadow-none sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <Footprints size={17} className="text-primary" aria-hidden="true" />
          <h2 className="font-bold text-ink">Mi trabajo</h2>
        </div>
        <p className="text-sm text-muted">
          Hiciste más de 500 paseos en los últimos 31 días: son más de los que esta cuenta lee, así que
          prefiere no darte un número antes que darte uno equivocado.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-4 shadow-none sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <Footprints size={17} className="text-primary" aria-hidden="true" />
        <h2 className="font-bold text-ink">Mi trabajo</h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        De tus paseos de los últimos {WINDOW_DAYS} días. No es toda tu historia: es la ventana que cuenta esta tarjeta.
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl bg-ink/[0.04] p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <Icon size={13} aria-hidden="true" /> {label}
            </dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-ink/[0.03] px-3 py-2">
          <dt className="text-2xs uppercase tracking-wide text-muted">Tu primer paseo de esta ventana</dt>
          <dd className="mt-0.5 text-sm text-ink">{formatDate(summary.firstDate)}</dd>
        </div>
        <div className="rounded-xl bg-ink/[0.03] px-3 py-2">
          <dt className="text-2xs uppercase tracking-wide text-muted">El más reciente</dt>
          <dd className="mt-0.5 text-sm text-ink">{formatDate(summary.lastDate)}</dd>
        </div>
      </dl>

      {summary.upcoming > 0 && (
        <p className="mt-3 text-xs text-muted">
          Tienes {summary.upcoming} paseo{summary.upcoming === 1 ? '' : 's'} por delante.
        </p>
      )}
      {summary.cancelled > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <CircleSlash size={12} aria-hidden="true" />
          {summary.cancelled} cancelado{summary.cancelled === 1 ? '' : 's'} en esta ventana. Se cuentan aparte, nunca como completados.
        </p>
      )}
    </Card>
  )
}
