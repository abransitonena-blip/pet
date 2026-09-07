'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, History } from 'lucide-react'
import { Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import WalkerSessionCard from '@/components/walker/WalkerSessionCard'
import { useWalkerPanel } from '@/app/walker/WalkerPanelContext'
import { useWalkerSessions } from '@/lib/useServiceOrders'
import { sortWalkerSessions, walkerReadErrorMessage, walkerSessionDate, walkerSessionStatus } from '@/lib/walkerPanel'

type HistoryFilter = 'all' | 'today' | 'upcoming' | 'completed'

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA')
}

export default function WalkerHistoryPage() {
  const { uid } = useWalkerPanel()
  const { sessions, loading, error, retry } = useWalkerSessions(uid)
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

  if (loading) return <LoadingState message="Consultando tu historial…" rows={5} height="h-20" />
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
          <p className="text-sm text-muted">{completed.length} paseos completados</p>
        </div>
      </header>

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
          <EmptyState
            icon={<History size={21} />}
            title={filter === 'all' ? 'Todavía no hay paseos en tu historial' : 'No hay resultados para este filtro'}
            description="Las sesiones asignadas aparecerán aquí sin mezclar reservas legacy."
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
