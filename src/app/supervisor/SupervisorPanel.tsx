'use client'

import { PageHeader, DataCard, StatusBadge, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { LayoutDashboard } from 'lucide-react'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import type { WalkSessionStatus } from '@/lib/domainStates'

const ACTIVE_STATUSES: WalkSessionStatus[] = [
  'assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress',
]

export default function SupervisorOverview() {
  const { reservations, loading, error, retry } = useCanonicalReservations({ max: 20 })

  const total = reservations.length
  const active = reservations.filter((item) => ACTIVE_STATUSES.includes(item.status)).length
  const completed = reservations.filter((item) => item.status === 'completed').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operación"
        description="Consulta autorizada de la operación (solo lectura, sin gestión de roles ni configuración global)."
        icon={<LayoutDashboard size={20} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DataCard title="Paseos recientes">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{total}</p>
        </DataCard>
        <DataCard title="En curso / programados">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{active}</p>
        </DataCard>
        <DataCard title="Completados">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{completed}</p>
        </DataCard>
      </div>

      <DataCard title="Últimos paseos" padded={false}>
        {loading ? (
          <LoadingState message="Cargando operación..." rows={4} />
        ) : error ? (
          <ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} />
        ) : reservations.length === 0 ? (
          <EmptyState illustration="durmiendo" icon={<LayoutDashboard size={20} />} title="Sin paseos" description="No hay paseos para supervisar todavía." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {reservations.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.name || 'Paseo'}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {item.service} · {item.date}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  )
}
