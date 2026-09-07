'use client'

import Link from 'next/link'
import { CalendarDays, Plus } from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/sessionMachine'
import { canonicalReadErrorMessage, useCustomerWalkSessions } from '@/lib/useCanonicalWalkSessions'

export default function CanonicalFamilyRequests({ customerId }: { customerId: string }) {
  const { sessions, loading, error, retry } = useCustomerWalkSessions(customerId)

  if (loading) return <LoadingState message="Consultando tus solicitudes…" rows={2} height="h-20" />
  if (error) return <Card className="shadow-none"><ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} /></Card>

  return (
    <section aria-labelledby="family-canonical-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Solicitudes actuales</p>
          <h2 id="family-canonical-title" className="mt-1 text-base font-bold text-ink">Paseos solicitados</h2>
        </div>
        <Link href="/familia/nueva-reserva" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Plus size={16} /> Nueva
        </Link>
      </div>

      {sessions.length === 0 ? (
        <Card className="shadow-none">
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="Aún no tienes solicitudes canónicas"
            description="Al enviar una solicitud aparecerá aquí como Solicitada; el equipo PET la revisará antes de asignar un paseador."
            action={<Link href="/familia/nueva-reserva" className="btn-primary inline-flex min-h-11 items-center">Solicitar paseo</Link>}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.slice(0, 5).map((session) => {
            const colors = STATUS_COLORS[session.status] ?? STATUS_COLORS.requested
            return (
              <Card key={session.id} className="flex items-center gap-3 p-4 shadow-none">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{session.serviceId}</p>
                  <p className="mt-1 text-xs text-muted">{session.scheduledDate} · {session.scheduledStart}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${colors.bg} ${colors.text}`}>
                  {STATUS_LABELS[session.status] ?? session.status}
                </span>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
