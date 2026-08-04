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

const lastUpdated = '30 de julio de 2026'

type PrivacySection = {
  title: string
  content: string
  providers?: { name: string; purpose: string; country: string }[]
}

const sections: PrivacySection[] = [
  {
    title: '1. Responsable de los datos',
    content: `${BRAND.name}, con domicilio en Ciudad de México, es responsable del tratamiento de sus datos personales. Este aviso aplica al sitio web pet-euhz.vercel.app y a los servicios de paseo canino.`,
  },
  {
    title: '2. Datos que recopilamos',
    content: 'Recopilamos únicamente los datos necesarios para el servicio: nombre, correo electrónico, número telefónico (WhatsApp), datos de sus mascotas (nombre, raza, tamaño, edad, condiciones médicas relevantes), dirección de recogida y ubicación durante el paseo. El correo y el nombre son obligatorios para crear una cuenta; el teléfono y la dirección son necesarios para prestar el servicio; los demás datos son opcionales. No recopilamos más información de la necesaria para cada finalidad.',
  },
  {
    title: '3. Finalidad del tratamiento',
    content: 'Utilizamos sus datos para: (a) prestar los servicios de paseo canino contratados y coordinar horarios, paseadores y zonas; (b) procesar pagos; (c) enviar confirmaciones, recordatorios y notificaciones del servicio; (d) mejorar nuestro servicio con métricas anónimas; (e) enviar comunicaciones promocionales, solo con su consentimiento previo; y (f) cumplir obligaciones legales y fiscales. Las finalidades (a), (b), (c) y (f) son necesarias para el servicio; (d) y (e) requieren consentimiento.',
  },
  {
    title: '4. Proveedores y transferencias',
    content: 'Para operar el servicio utilizamos los siguientes proveedores, que tratan sus datos únicamente bajo nuestras instrucciones y con medidas de seguridad:',
  },
  {
    title: '5. Proveedores detallados',
    content: '',
    providers: [
      { name: 'Google LLC', purpose: 'Inicio de sesión con Google (cuenta) y Google Analytics 4 (métricas anónimas de uso, solo con su consentimiento)', country: 'EE. UU.' },
      { name: 'Firebase (Google)', purpose: 'Base de datos (Firestore), autenticación y notificaciones push', country: 'EE. UU.' },
      { name: 'Vercel Inc.', purpose: 'Hospedaje del sitio web', country: 'EE. UU.' },
      { name: 'Cloudinary', purpose: 'Almacenamiento y entrega de fotografías', country: 'EE. UU.' },
      { name: 'WhatsApp (Meta)', purpose: 'Comunicación y confirmación de paseos', country: 'EE. UU.' },
    ],
  },
  {
    title: '6. Retención',
    content: 'Conservamos sus datos solo mientras sean necesarios para el servicio y las obligaciones fiscales: datos de reservas e historial, 5 años por obligaciones fiscales; cuenta y perfiles, mientras su cuenta esté activa y hasta que solicite su baja; mensajes y notificaciones, 12 meses; métricas analíticas, 14 meses; fotografías, hasta que solicite su eliminación. Al cumplirse estos plazos, los datos se eliminan o anonimizan.',
  },
  {
    title: '7. Derechos ARCO',
    content: 'Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales, así como a la portabilidad cuando aplique. Para ejercer estos derechos, envíe un correo a ' + BRAND.email + ' con el asunto "Derechos ARCO" y su solicitud será atendida en un plazo máximo de 15 días hábiles. También puede solicitar la eliminación de su cuenta y sus datos en cualquier momento.',
  },
  {
    title: '8. Seguridad de la información',
    content: 'Implementamos medidas de seguridad administrativas, técnicas y físicas para proteger sus datos personales contra daño, pérdida, alteración, destrucción o uso no autorizado. Sus datos se transmiten cifrados (HTTPS) y se almacenan en servicios con cifrado en tránsito y en reposo.',
  },
  {
    title: '9. Cookies y analítica',
    content: 'Solo utilizamos Google Analytics 4 (miden uso del sitio de forma anónima). La analítica está desactivada por defecto: al visitar el sitio se mostrará un aviso y solo si usted acepta se cargará el código de analítica. Puede rechazarla sin que el servicio se vea afectado, y puede cambiar su elección en cualquier momento. No usamos cookies de publicidad ni de rastreo de terceros.',
  },
  {
    title: '10. Cambios al aviso de privacidad',
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
