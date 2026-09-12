'use client'

import { useConfig } from '@/context/ConfigContext'

/**
 * Los consejos para el paseo, en la página pública.
 *
 * Administración ya los escribía en Configuración y sólo los veía una familia
 * con cuenta. Son justo lo que convence a alguien que todavía está decidiendo:
 * dicen cómo se cuida a un perro aquí, con las palabras del propio negocio.
 *
 * Si se borran todos, la sección desaparece en vez de dejar un hueco con título.
 */
export default function WalkTipsSection() {
  const { config } = useConfig()
  const tips = (config.walkTips ?? []).filter((tip) => tip.title?.trim() && tip.text?.trim())

  if (tips.length === 0) return null

  return (
    <section aria-labelledby="walk-tips-title" id="consejos" className="scroll-mt-20 py-16 sm:py-24">
      <div className="section-container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium uppercase tracking-widest text-primary-hover">Consejos</span>
          <h2 id="walk-tips-title" className="section-title mt-3">Cómo cuidamos a <span className="text-primary">tu perro</span></h2>
          <p className="section-subtitle">Lo que recomendamos antes y después de cada paseo.</p>
        </div>

        <ul className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tips.map((tip, index) => (
            <li key={`${tip.title}-${index}`} className="card p-5">
              {tip.icon && <p aria-hidden="true" className="text-2xl">{tip.icon}</p>}
              <h3 className="mt-2 text-sm font-semibold text-ink">{tip.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{tip.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
