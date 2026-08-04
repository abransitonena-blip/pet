import { Dog } from 'lucide-react'
import Link from 'next/link'
import { termsSections, TERMS_LAST_UPDATED } from '@/lib/termsContent'

export const metadata = {
  title: 'Términos y condiciones | PET Ap',
  description:
    'Términos y condiciones de PET Ap: reservas, cancelaciones, salud y seguridad, responsabilidad, privacidad y precios.',
}

export default function TerminosPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white">
            <Dog size={24} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-ink">Términos y condiciones</h1>
            <p className="text-sm text-muted mt-1">Última actualización: {TERMS_LAST_UPDATED}</p>
          </div>
        </div>

        <div className="space-y-6">
          {termsSections.map((section, i) => {
            const Icon = section.icon
            return (
              <section
                key={i}
                className="card p-5 sm:p-6 rounded-2xl"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="text-primary" size={18} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-ink mb-2">{section.title}</h2>
                    <p className="text-sm text-muted leading-relaxed">{section.content}</p>
                  </div>
                </div>
              </section>
            )
          })}
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/privacidad" className="btn-secondary">
            Política de privacidad
          </Link>
          <Link href="/" className="btn-primary">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
