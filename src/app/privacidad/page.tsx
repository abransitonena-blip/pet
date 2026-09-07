import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { PRIVACY_DRAFT_VERSION, RETENTION_MATRIX, STORAGE_INVENTORY } from '@/lib/privacyConfig'
import { publicPageMetadata } from '@/lib/seoMetadata'

export const metadata: Metadata = publicPageMetadata({ path: '/privacidad', title: 'Aviso de privacidad', description: 'Borrador operativo sobre datos, finalidades, proveedores, retención y solicitudes ARCO de PET Ap.' })

const lastUpdated = '8 de agosto de 2026'

type PrivacySection = {
  title: string
  content: string
  providers?: { name: string; purpose: string; country: string }[]
}

const sections: PrivacySection[] = [
  {
    title: '1. Responsable y alcance',
    content: `${BRAND.name}, operación ubicada en Ciudad de México y disponible en ${BRAND.email}, prepara este aviso para describir el tratamiento realizado por el sitio y el servicio de paseo. La identidad jurídica, domicilio completo y canales formales deben validarse antes del lanzamiento comercial. Versión operativa: ${PRIVACY_DRAFT_VERSION}.`,
  },
  {
    title: '2. Categorías de datos',
    content: 'Podemos tratar identificadores de cuenta, nombre, correo, teléfono, perfiles de perros, dirección de recogida, agenda, órdenes, sesiones, pagos confirmados, reportes y comunicaciones. Información de salud o conducta del perro solo debe proporcionarse cuando sea necesaria para realizar el paseo de forma segura. No solicitamos diagnósticos médicos de personas.',
  },
  {
    title: '3. Finalidades necesarias',
    content: 'Crear y proteger la cuenta; gestionar perfiles de perros y direcciones; recibir, confirmar y ejecutar solicitudes de paseo; asignar personal; atender incidencias; mantener notificaciones internas; gestionar pagos y soporte; y conservar evidencia operativa cuando sea necesario. Negarse a proporcionar un dato indispensable puede impedir esa operación concreta.',
  },
  {
    title: '4. Finalidades opcionales y consentimientos separados',
    content: 'Son opcionales y no condicionan el servicio: Analytics, marketing, comunicaciones promocionales, testimonios públicos, publicación en galería y publicación en redes sociales. Permitir capturar una foto para un reporte privado no equivale a autorizar su publicación. Las cargas operativas y la publicación automática permanecen desactivadas durante el MVP.',
  },
  {
    title: '5. Proveedores y comunicaciones',
    content: 'Los proveedores pueden procesar datos fuera de México conforme a su propia infraestructura y condiciones. El alcance contractual y las transferencias deben revisarse profesionalmente antes del lanzamiento comercial.',
    providers: [
      { name: 'Firebase / Google', purpose: 'Autenticación y Firestore. FCM permanece desactivado.', country: 'Infraestructura internacional' },
      { name: 'Vercel', purpose: 'Hosting actual. La producción comercial deberá cambiar de plan o proveedor.', country: 'Infraestructura internacional' },
      { name: 'Cloudflare', purpose: 'Alternativa futura preparada, todavía no desplegada.', country: 'No aplica todavía' },
      { name: 'Cloudinary', purpose: 'URLs públicas legacy. Uploads privados y unsigned desactivados.', country: 'Infraestructura internacional' },
      { name: 'WhatsApp / Meta', purpose: 'Solo cuando la persona decide abrir WhatsApp y confirma el mensaje.', country: 'Infraestructura internacional' },
      { name: 'Google Analytics', purpose: 'Solo si configuración y consentimiento analítico están activos; publicidad siempre denegada.', country: 'Infraestructura internacional' },
    ],
  },
  {
    title: '6. Retención',
    content: 'La matriz mostrada abajo contiene plazos operativos propuestos, no plazos legales definitivos. En el MVP los procesos de revisión y eliminación son manuales. Pueden existir excepciones por servicios activos, controversias u obligaciones aplicables, que deben documentarse.',
  },
  {
    title: '7. Derechos ARCO, revocación y retiro de fotografías',
    content: `Puede solicitar acceso, rectificación, cancelación u oposición, revocar consentimientos o pedir el retiro de una fotografía desde Familia PET o escribiendo a ${BRAND.email}. Se asignará un folio y se verificará identidad antes de revelar o modificar datos. No prometemos eliminación inmediata: deben revisarse Firestore, autenticación, proveedores, derivados, cachés y excepciones documentadas.`,
  },
  {
    title: '8. Seguridad de la información',
    content: 'Aplicamos controles de acceso por rol y documento, minimización, feature flags y procedimientos manuales. Ninguna medida elimina por completo el riesgo. Las credenciales legacy detectadas requieren revocación manual y no se consideran una protección válida.',
  },
  {
    title: '9. Cookies y analítica',
    content: 'Analytics está desactivado por defecto. Antes de aceptar no se carga gtag.js ni se envían eventos. Aceptar concede únicamente analytics_storage; ad_storage, ad_user_data y ad_personalization permanecen denegados. El control “Privacidad” permite rechazar, retirar o borrar la elección. La eliminación de cookies accesibles es de mejor esfuerzo y no borra automáticamente información ya procesada por un proveedor.',
  },
  {
    title: '10. Cambios al aviso de privacidad',
    content: 'Los cambios se identificarán mediante fecha y versión. Cuando una nueva finalidad opcional requiera consentimiento, no se asumirá aceptación por silencio o por el uso del servicio.',
  },
  {
    title: '11. Estado jurídico del documento',
    content: 'Este documento es un borrador operativo y requiere revisión jurídica profesional antes del lanzamiento comercial. La referencia general utilizada es el texto vigente de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares publicado por la Cámara de Diputados; esta página no constituye asesoría legal ni afirma cumplimiento absoluto.',
  },
]

export default function PrivacidadPage() {
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
            Última actualización: {lastUpdated}
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
