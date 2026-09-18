'use client'

import dynamic from 'next/dynamic'

// La cancelación por teléfono consulta el historial anterior, que trae el SDK
// de Firestore. La pantalla se dibuja antes de que ese código llegue.
const CancelarPanel = dynamic(() => import('./CancelarPanel'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-canvas p-6">
      <div className="mx-auto max-w-md space-y-4">
        <span className="sr-only" role="status">Cargando…</span>
        <div className="skeleton h-10 w-40 rounded-xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    </main>
  ),
})

export default function CancelarPage() {
  return <CancelarPanel />
}
