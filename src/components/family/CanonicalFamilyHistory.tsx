'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui'
import { canonicalReadErrorMessage, useCustomerWalkSessions } from '@/lib/useCanonicalWalkSessions'
import { monthWindow } from '@/lib/recentWindow'
import { canCancel } from '@/lib/familyCancellation'
import CancelWalkButton from '@/components/family/CancelWalkButton'

/**
 * El historial, un mes a la vez.
 *
 * Antes pedía "todos" los paseos: orden ascendente con tope de 100, o sea los
 * cien MÁS ANTIGUOS. Una familia con paseo diario dejaba de ver lo suyo a los
 * tres meses. Un mes cabe de sobra en el tope, y además es como la gente busca
 * un paseo: por cuándo fue.
 */
export default function CanonicalFamilyHistory({ customerId }: { customerId: string }) {
  const [offset, setOffset] = useState(0)
  const today = new Date().toLocaleDateString('en-CA')
  const window = monthWindow(today, offset)
  const { sessions, loading, error, capped, retry } = useCustomerWalkSessions(customerId, {
    since: window.since,
    until: window.until,
  })
  const sorted = [...sessions].sort((a, b) => `${b.scheduledDate}-${b.scheduledStart}`.localeCompare(`${a.scheduledDate}-${a.scheduledStart}`))

  const nav = (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => setOffset((current) => current - 1)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ChevronLeft size={16} aria-hidden="true" /> Mes anterior
      </button>
      <p className="text-sm font-semibold capitalize text-ink" aria-live="polite">{window.label}</p>
      <button
        type="button"
        onClick={() => setOffset((current) => current + 1)}
        disabled={offset >= 0}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
      >
        Mes siguiente <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  )

  return (
    <div className="space-y-3">
      {nav}
      {capped && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800" role="status">
          Este mes tiene más paseos de los que cabe mostrar aquí. Los más recientes del mes podrían faltar.
        </p>
      )}
      {loading ? (
        <LoadingState message="Consultando tus paseos…" rows={3} height="h-20" />
      ) : error ? (
        <Card className="p-4 shadow-none"><ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} /></Card>
      ) : sorted.length === 0 ? (
        <Card className="shadow-none">
          <EmptyState
            icon={<CalendarDays size={21} />}
            title={`Sin paseos en ${window.label}`}
            description="Cambia de mes para ver otros, o solicita uno nuevo."
          />
        </Card>
      ) : (
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
              {canCancel(session.status) && (
                <div className="mt-3 sm:mt-0">
                  <CancelWalkButton sessionId={session.id} uid={customerId} status={session.status} />
                </div>
              )}
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
      )}
    </div>
  )
}
