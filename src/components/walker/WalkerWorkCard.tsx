'use client'

import { useMemo } from 'react'
import { CalendarCheck, CalendarDays, CircleSlash, Footprints, TrendingUp } from 'lucide-react'
import Card from '@/components/ui/Card'
import { useWalkerSessions } from '@/lib/useServiceOrders'
import { walkerSessionDate, walkerSessionStatus } from '@/lib/walkerPanel'
import { activeDays, summarizeWalkerWork } from '@/lib/walkerStats'

/**
 * Lo que este paseador ha hecho, contado de sus propios paseos.
 *
 * Su panel le decía qué hacer hoy y nada de lo que ya hizo. Aquí están sus
 * números -- completados, esta semana, este mes, días distintos que salió -- sin
 * puntajes ni medallas: una "puntuación" con fórmula propia se ve bonita y no le
 * dice a nadie qué hacer distinto mañana.
 *
 * Sale de la misma ventana que ya carga el panel, y la tarjeta lo dice: son los
 * 100 paseos más recientes, no toda su historia. Decir "23 paseos" cuando son
 * "23 de los últimos 100" empieza a mentir en cuanto alguien pase de cien.
 */

// El mismo tope que usa la consulta del panel.
const WINDOW = 100

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA')
}

function formatDate(date: string): string {
  if (!date) return '—'
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function WalkerWorkCard({ uid }: { uid: string }) {
  const { sessions, loading } = useWalkerSessions(uid)

  const rows = useMemo(
    () => sessions.map((session) => ({ date: walkerSessionDate(session), status: walkerSessionStatus(session) })),
    [sessions],
  )
  const summary = useMemo(() => summarizeWalkerWork(rows, todayKey()), [rows])
  const days = useMemo(() => activeDays(rows), [rows])

  if (loading || rows.length === 0) return null

  const tiles = [
    { label: 'Paseos completados', value: summary.completed, icon: Footprints },
    { label: 'Esta semana', value: summary.completedThisWeek, icon: TrendingUp },
    { label: 'Este mes', value: summary.completedThisMonth, icon: CalendarDays },
    { label: 'Días que saliste', value: days, icon: CalendarCheck },
  ]

  return (
    <Card className="p-4 shadow-none sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <Footprints size={17} className="text-primary" aria-hidden="true" />
        <h2 className="font-bold text-ink">Mi trabajo</h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        De tus {WINDOW} paseos más recientes. No es toda tu historia: es la ventana que carga tu panel.
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
