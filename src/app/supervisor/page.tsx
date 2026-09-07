'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState } from '@/components/ui'
import { LayoutDashboard } from 'lucide-react'
import type { Reservation } from '@/types'

interface SupervisedReservation extends Reservation {
  id: string
}

export default function SupervisorOverview() {
  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState<SupervisedReservation[]>([])

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'), limit(20))
    const unsub = onSnapshot(q, (snap) => {
      setReservations(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupervisedReservation)
      )
      setLoading(false)
    })
    return unsub
  }, [])

  const total = reservations.length
  const active = reservations.filter((r) => r.status === 'assigned' || r.status === 'walker_confirmed' || r.status === 'on_the_way' || r.status === 'arrived' || r.status === 'in_progress').length
  const completed = reservations.filter((r) => r.status === 'completed').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operación"
        description="Consulta autorizada de la operación (solo lectura, sin gestión de roles ni configuración global)."
        icon={<LayoutDashboard size={20} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DataCard title="Reservas recientes">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{total}</p>
        </DataCard>
        <DataCard title="En curso / programadas">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{active}</p>
        </DataCard>
        <DataCard title="Completadas">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{completed}</p>
        </DataCard>
      </div>

      <DataCard title="Últimas reservas" padded={false}>
        {loading ? (
          <LoadingState message="Cargando operación..." rows={4} />
        ) : reservations.length === 0 ? (
          <EmptyState icon={<LayoutDashboard size={20} />} title="Sin reservas" description="No hay reservas para supervisar todavía." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {reservations.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {r.name || r.customer?.name || 'Reserva'}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {r.service} · {r.date}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  )
}
