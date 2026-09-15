'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import CanonicalDispatchPanel from '@/components/admin/CanonicalDispatchPanel'

// Las dos vistas de consulta leen colecciones que ya nadie escribe. Se cargan
// al abrirlas: antes, esta página escuchaba `reservations` y `serviceOrders`
// aunque se mirara sólo la cola de solicitudes.
const LegacyReservationsTab = dynamic(() => import('@/components/admin/LegacyReservationsView'), {
  loading: () => <LoadingState rows={5} height="h-24" />,
})
const LegacyOrdersView = dynamic(() => import('@/components/admin/LegacyOrdersView'), {
  loading: () => <LoadingState rows={3} height="h-20" />,
})

type View = 'canonical' | 'reservations' | 'orders'

const VIEWS: { id: View; label: string }[] = [
  { id: 'canonical', label: 'Por asignar' },
  { id: 'reservations', label: 'Historial anterior' },
  { id: 'orders', label: 'Paquetes anteriores' },
]

export default function AdminReservas() {
  const [viewTab, setViewTab] = useState<View>('canonical')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitudes y paseos"
        description={viewTab === 'canonical'
          ? 'Asigna cada solicitud a un paseador activo.'
          : 'Registros de antes de la migración, sólo para consulta.'}
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Qué ver">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => setViewTab(view.id)}
            aria-pressed={viewTab === view.id}
            className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              viewTab === view.id ? 'border-brand-500/30 bg-brand-500/15 text-brand-700' : 'border-ink/15 text-muted hover:text-ink'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {viewTab === 'canonical' && <CanonicalDispatchPanel />}
      {viewTab === 'reservations' && <LegacyReservationsTab />}
      {viewTab === 'orders' && <LegacyOrdersView />}
    </div>
  )
}
