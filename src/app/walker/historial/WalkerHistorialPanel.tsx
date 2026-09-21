'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, History } from 'lucide-react'
import { Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import WalkerSessionCard from '@/components/walker/WalkerSessionCard'
import { useWalkerPanel } from '@/app/walker/WalkerPanelContext'
import { useWalkerSessions } from '@/lib/useServiceOrders'
import { sortWalkerSessions, walkerReadErrorMessage, walkerSessionDate, walkerSessionStatus } from '@/lib/walkerPanel'
import { monthWindow } from '@/lib/recentWindow'
import { WALK_WINDOW_MAX_PAGES } from '@/lib/walkWindowQueries'

type HistoryFilter = 'all' | 'today' | 'upcoming' | 'completed'

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA')
}

/**
 * El historial del paseador, un mes a la vez.
 *
 * Pedía "todos" sus paseos: orden ascendente con tope de 100, o sea los cien
 * MÁS ANTIGUOS. Quien sale cinco veces al día perdía de vista lo suyo en tres
 * semanas. En el mes en curso la ventana no tiene techo, para que "Próximos"
 * siga mostrando lo que viene.
 */
export default function WalkerHistoryPage() {
  const { uid } = useWalkerPanel()
  const [offset, setOffset] = useState(0)
  const month = monthWindow(todayKey(), offset)
  // Un mes con más de cien paseos sigue en más consultas, hasta 500.
  const { sessions, loading, loadingMore, error, capped, retry } = useWalkerSessions(uid, {
    since: month.since,
    until: offset < 0 ? month.until : undefined,
    maxPages: WALK_WINDOW_MAX_PAGES,
  })
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const sorted = useMemo(() => sortWalkerSessions(sessions, 'desc'), [sessions])
  const today = todayKey()
  const completed = sorted.filter((session) => walkerSessionStatus(session) === 'completed')
  const todaySessions = sorted.filter((session) => walkerSessionDate(session) === today)
  const upcoming = sorted.filter((session) => walkerSessionDate(session) > today && !['completed', 'cancelled', 'no_show'].includes(walkerSessionStatus(session)))
  const filtered = filter === 'completed'
    ? completed
    : filter === 'today'
      ? todaySessions
      : filter === 'upcoming'
        ? upcoming
        : sorted

  // Con el resto del mes en camino, "Hoy" y "Próximos" estarían incompletos.
  if (loading || loadingMore) return <LoadingState message={loadingMore ? 'Cargando el resto del mes…' : 'Consultando tu historial…'} rows={5} height="h-20" />
  if (error) return <Card className="p-4 shadow-none"><ErrorState description={walkerReadErrorMessage(error)} onRetry={retry} /></Card>

  const filters: Array<{ value: HistoryFilter; label: string; count: number }> = [
    { value: 'all', label: 'Todos', count: sorted.length },
    { value: 'today', label: 'Hoy', count: todaySessions.length },
    { value: 'upcoming', label: 'Próximos', count: upcoming.length },
    { value: 'completed', label: 'Completados', count: completed.length },
  ]

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/walker" aria-label="Volver a Mis paseos" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Actividad</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Historial</h1>
          <p className="text-sm text-muted">{completed.length} completados en <span className="capitalize">{month.label}</span></p>
        </div>
      </header>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-11 shrink-0" onClick={() => setOffset((current) => current - 1)}>
          <ChevronLeft size={16} aria-hidden="true" /> Mes anterior
        </Button>
        <p className="text-sm font-semibold capitalize text-ink" aria-live="polite">{month.label}</p>
        <Button type="button" variant="ghost" size="sm" className="h-11 shrink-0" disabled={offset >= 0} onClick={() => setOffset((current) => current + 1)}>
          Mes siguiente <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>

      {capped && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800" role="status">
          Este mes no se pudo cargar completo. Los paseos más recientes del mes podrían faltar.
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar historial">
        {filters.map((item) => (
          <Button
            key={item.value}
            type="button"
            variant={filter === item.value ? 'primary' : 'ghost'}
            size="sm"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={`h-11 shrink-0 ${filter === item.value ? 'text-white' : ''}`}
          >
            {item.label} ({item.count})
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="shadow-none">
          <EmptyState illustration="durmiendo"
            icon={<History size={21} />}
            title={filter === 'all' ? `Sin paseos en ${month.label}` : 'No hay resultados para este filtro'}
            description="Cambia de mes para ver otros."
            action={filter !== 'all' ? <Button variant="secondary" onClick={() => setFilter('all')}>Ver todos</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => <WalkerSessionCard key={session.id} session={session} compact />)}
        </div>
      )}
    </div>
  )
}
