import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Aviso de Privacidad',
  description: 'Conoce cómo PET Ap protege y maneja tus datos personales. Política de privacidad y protección de datos.',
  openGraph: {
    title: 'Aviso de Privacidad | PET Ap',
    description: 'Conoce cómo protegemos tus datos personales.',
  },
}

const lastUpdated = '15 de enero de 2026'

const sections = [
  {
    title: '1. Responsable de los datos',
    content: `${BRAND.name}, con domicilio en Ciudad de México, es responsable del tratamiento de sus datos personales.`,
  },
  {
    title: '2. Datos que recopilamos',
    content: 'Recopilamos la siguiente información: nombre, correo electrónico, número telefónico, dirección, datos de sus mascotas (nombre, raza, tamaño, edad, condiciones médicas), ubicación geográfica para la prestación del servicio, e información de pago. Esta información se obtiene cuando usted se registra, realiza una reserva o se comunica con nosotros.',
  },
  {
    title: '3. Finalidad del tratamiento',
    content: 'Utilizamos sus datos para: proporcionar los servicios de paseo canino contratados, procesar pagos, enviar confirmaciones y recordatorios, mejorar nuestros servicios, enviar comunicaciones promocionales (con su consentimiento), y cumplir con obligaciones legales y fiscales.',
  },
  {
    title: '4. Transferencia de datos',
    content: 'No compartimos sus datos personales con terceros no relacionados con la prestación del servicio, salvo obligación legal. Los datos de pago se procesan a través de plataformas seguras que cumplen con los estándares de la industria.',
  },
  {
    title: '5. Derechos ARCO',
    content: 'Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales. Para ejercer estos derechos, envíe un correo a ' + BRAND.email + ' con el asunto "Derechos ARCO" y su solicitud será atendida en un plazo máximo de 20 días hábiles.',
  },
  {
    title: '6. Seguridad de la información',
    content: 'Implementamos medidas de seguridad administrativas, técnicas y físicas para proteger sus datos personales contra daño, pérdida, alteración, destrucción o uso no autorizado. Sus datos se almacenan en servidores seguros con cifrado en tránsito y en reposo.',
  },
  {
    title: '7. Uso de cookies',
    content: 'Utilizamos cookies y tecnologías similares para mejorar su experiencia en nuestro sitio, analizar el tráfico y personalizar contenido. Puede configurar su navegador para rechazar cookies, aunque algunas funciones podrían verse afectadas.',
  },
  {
    title: '8. Cambios al aviso de privacidad',
    content: 'Nos reservamos el derecho de modificar este aviso de privacidad en cualquier momento. Los cambios entrarán en vigor a partir de su publicación en el sitio. Le notificaremos sobre cambios significativos a través de los medios de contacto que haya proporcionado.',
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
                <p className="text-muted leading-relaxed">{s.content}</p>
              </div>
            ))}
          </div>

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
