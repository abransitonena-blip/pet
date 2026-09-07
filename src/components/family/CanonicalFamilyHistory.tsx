'use client'

import Link from 'next/link'
import { CalendarDays, FileText } from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui'
import { canonicalReadErrorMessage, useCustomerWalkSessions } from '@/lib/useCanonicalWalkSessions'

export default function CanonicalFamilyHistory({ customerId }: { customerId: string }) {
  const { sessions, loading, error, retry } = useCustomerWalkSessions(customerId)
  const sorted = [...sessions].sort((a, b) => `${b.scheduledDate}-${b.scheduledStart}`.localeCompare(`${a.scheduledDate}-${a.scheduledStart}`))

  if (loading) return <LoadingState message="Consultando tus paseos canónicos…" rows={3} height="h-20" />
  if (error) return <Card className="p-4 shadow-none"><ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} /></Card>
  if (sorted.length === 0) {
    return (
      <Card className="shadow-none">
        <EmptyState
          icon={<CalendarDays size={21} />}
          title="Aún no tienes solicitudes canónicas"
          description="Las nuevas solicitudes y sus reportes aparecerán aquí. El historial anterior permanece abajo en solo lectura."
        />
      </Card>
    )
  }

  return (
    <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-surface">
      {sorted.map((session) => (
        <article key={session.id} className="p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-ink">{session.serviceId || 'Servicio canónico'}</p>
              <StatusBadge status={session.status} />
            </div>
            <p className="mt-1 text-xs text-muted">{session.scheduledDate || 'Fecha pendiente'} · {session.scheduledStart || 'Hora pendiente'}</p>
          </div>
          {session.status === 'completed' && (
            <div className="mt-3 flex w-full flex-col gap-2 sm:mt-0 sm:w-auto sm:flex-row">
              <Link href={`/familia/reportes/${encodeURIComponent(session.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <FileText size={16} aria-hidden="true" /> Ver reporte
              </Link>
              <Link href={`/familia/tickets/${encodeURIComponent(session.id)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                Ticket interno
              </Link>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
