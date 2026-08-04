import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { ShieldCheck, Heart, Leaf, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Nosotros',
  description: 'Conoce a PET Ap, la plataforma de bienestar canino que combina tecnología y amor por los perros para ofrecer paseos personalizados.',
  openGraph: {
    title: 'Nosotros | PET Ap',
    description: 'Conoce nuestra historia y compromiso con el bienestar canino.',
  },
}

const values = [
  {
    icon: Heart,
    title: 'Amor por los perros',
    desc: 'Cada paseo se da con paciencia, respeto y cariño. Priorizamos el bienestar físico y emocional de tu mascota.',
  },
  {
    icon: ShieldCheck,
    title: 'Confianza y seguridad',
    desc: 'Todos nuestros paseadores son certificados, evaluados y cuentan con seguro de responsabilidad civil.',
  },
  {
    icon: Leaf,
    title: 'Compromiso ecológico',
    desc: 'Usamos bolsas biodegradables, promovemos la hidratación responsable y optimizamos rutas para reducir nuestra huella.',
  },
  {
    icon: Users,
    title: 'Comunidad',
    desc: 'Construimos una red de dueños responsables y paseadores apasionados que cuidan a los peludos como si fueran suyos.',
  },
]

export default function NosotrosPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-primary-hover text-sm uppercase tracking-widest font-medium">
            Conócenos
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3 text-ink">
            Tu perro merece más que un paseo
          </h1>
          <p className="mt-4 text-muted text-base sm:text-lg max-w-xl mx-auto">
            En {BRAND.name} combinamos tecnología, pasión y profesionalismo para transformar
            la experiencia del paseo canino.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-ink mb-4">Nuestra historia</h2>
            <div className="space-y-4 text-muted leading-relaxed">
              <p>
                Nacimos de una idea simple: los perros merecen algo mejor que un paseo
                apresurado. Queremos que cada salida sea una experiencia enriquecedora, 
                segura y divertida para ellos, y que sus dueños tengan total tranquilidad.
              </p>
              <p>
                Lo que empezó como un servicio local de paseos se convirtió en una plataforma 
                tecnológica que conecta a dueños responsables con paseadores certificados. 
                Hoy, cientos de perros disfrutan de paseos personalizados mientras sus familias 
                reciben fotos, reportes y la certeza de que están en buenas manos.
                La tecnología está al servicio del bienestar animal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="pb-24 sm:pb-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-primary-hover text-sm uppercase tracking-widest font-medium">
              Nuestros pilares
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-3 text-ink">
              Lo que nos <span className="gradient-text">define</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {values.map((v) => {
              const Icon = v.icon
              return (
                <div key={v.title} className="card p-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-ink mb-2">{v.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{v.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
