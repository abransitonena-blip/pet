/**
 * Lo que se ve mientras llega el código de un panel.
 *
 * Los paneles cargan el SDK de Firestore, que pesa unos 90 kB comprimidos. Al
 * pedirlos con `dynamic`, esa descarga deja de bloquear la primera pintura: se
 * ve esto en un instante y el panel entra cuando su código llega.
 */
export default function PanelFallback() {
  return (
    <div className="min-h-screen bg-canvas p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <span className="sr-only" role="status">Cargando el panel…</span>
        <div className="skeleton h-12 w-48 rounded-xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    </div>
  )
}
