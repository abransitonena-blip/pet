'use client'

import { BRAND } from '@/lib/brand'
import { RETENTION_MATRIX, STORAGE_INVENTORY } from '@/lib/privacyConfig'
import { mergePrivacySections, PRIVACY_LAST_UPDATED } from '@/lib/privacyContent'
import { useConfig } from '@/context/ConfigContext'

export default function PrivacidadContent() {
  const { config } = useConfig()
  const sections = mergePrivacySections(config.privacySections)
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">
            Legal
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3 text-ink">
            Aviso de <span className="gradient-text">Privacidad</span>
          </h1>
          <p className="mt-4 text-muted text-sm">
            Última actualización: {PRIVACY_LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-24 sm:pb-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-sm sm:prose-base max-w-none">
            {sections.map((s) => (
              <div key={s.title} className="mb-8">
                <h2 className="text-lg font-bold text-ink mb-2">{s.title}</h2>
                {s.content && <p className="text-muted leading-relaxed">{s.content}</p>}
                {s.providers && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm text-muted">
                      <thead>
                        <tr className="text-left text-ink border-b border-border">
                          <th className="py-2 pr-4 font-semibold">Proveedor</th>
                          <th className="py-2 pr-4 font-semibold">Finalidad</th>
                          <th className="py-2 font-semibold">País</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.providers.map((p) => (
                          <tr key={p.name} className="border-b border-border/50 align-top">
                            <td className="py-2 pr-4 font-medium text-ink">{p.name}</td>
                            <td className="py-2 pr-4">{p.purpose}</td>
                            <td className="py-2">{p.country}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          <section className="mt-12" aria-labelledby="retention-title">
            <h2 id="retention-title" className="text-xl font-bold text-ink">Matriz operativa de retención</h2>
            <p className="mt-2 text-sm text-muted">Plazos propuestos y procesos manuales sujetos a revisión jurídica y operativa.</p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-[900px] w-full text-xs text-muted">
                <thead><tr className="text-left text-ink border-b border-border"><th className="p-3">Categoría</th><th className="p-3">Plazo propuesto</th><th className="p-3">Inicio</th><th className="p-3">Eliminación</th><th className="p-3">Evidencia</th></tr></thead>
                <tbody>{RETENTION_MATRIX.map((item) => <tr key={item.category} className="border-b border-border/50 align-top"><td className="p-3 font-medium text-ink">{item.category}</td><td className="p-3">{item.period}</td><td className="p-3">{item.starts}</td><td className="p-3">{item.deletion}</td><td className="p-3">{item.evidence}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="mt-12" aria-labelledby="storage-title">
            <h2 id="storage-title" className="text-xl font-bold text-ink">Cookies y almacenamiento local</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-[800px] w-full text-xs text-muted">
                <thead><tr className="text-left text-ink border-b border-border"><th className="p-3">Nombre</th><th className="p-3">Tipo</th><th className="p-3">Categoría</th><th className="p-3">Finalidad</th><th className="p-3">Duración / retiro</th></tr></thead>
                <tbody>{STORAGE_INVENTORY.map((item) => <tr key={item.name} className="border-b border-border/50 align-top"><td className="p-3 font-medium text-ink">{item.name}</td><td className="p-3">{item.kind}</td><td className="p-3">{item.category}</td><td className="p-3">{item.purpose}</td><td className="p-3">{item.duration}. {item.removal}.</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <p className="mt-8 text-xs text-muted">
            Referencia oficial consultada:{' '}
            <a className="underline" href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf" target="_blank" rel="noreferrer">texto vigente de la LFPDPPP, Cámara de Diputados</a>.
          </p>

          <div className="mt-12 card p-6 text-center">
            <p className="text-sm text-muted mb-1">Para ejercer sus derechos ARCO</p>
            <a
              href={`mailto:${BRAND.email}?subject=Derechos%20ARCO`}
              className="text-primary font-medium hover:underline"
            >
              {BRAND.email}
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
