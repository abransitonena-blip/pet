'use client'

import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'
import { usePrices } from '@/context/PricesContext'
import { getReservationServiceOptions } from '@/lib/walkServices'
import { formatAmountCents } from '@/lib/servicePricing'

/**
 * Cuánto cuesta, en la página pública.
 *
 * "¿Me llegan?" y "¿cuánto cuesta?" son las dos preguntas de quien todavía no
 * tiene cuenta, y la segunda sólo se respondía entrando a reservar. Los precios
 * salen de la misma fuente que usa el flujo de reserva, así que la página no
 * puede prometer un número distinto del que se va a cobrar.
 *
 * Un servicio sin precio configurado no aparece: es mejor no decir nada que
 * inventar una cifra. Si no hay ninguno configurado, la sección desaparece
 * entera en lugar de dejar una promesa vacía.
 */
export default function PricingSection() {
  const { services, status } = usePrices()
  const options = getReservationServiceOptions(services)
    .filter((option) => option.isRequestable && option.amountCents !== null)

  if (status !== 'ready' || options.length === 0) return null

  return (
    <section aria-labelledby="pricing-title" id="precios" className="scroll-mt-20 py-16 sm:py-24">
      <div className="section-container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium uppercase tracking-widest text-primary-hover">Precios</span>
          <h2 id="pricing-title" className="section-title mt-3">Lo que cuesta un <span className="text-primary">paseo</span></h2>
          <p className="section-subtitle">Sin membresías ni cargos por registrarte. Pagas el paseo que pides.</p>
        </div>

        <ul className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option) => (
            <li key={option.id} className="card flex flex-col p-5">
              <h3 className="text-sm font-semibold text-ink">{option.name}</h3>
              <p className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">
                {formatAmountCents(option.amountCents, option.complimentary)}
              </p>
              {option.durationMinutes !== null && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <Clock size={13} aria-hidden="true" /> {option.durationMinutes} minutos
                </p>
              )}
              {option.mainBenefit && <p className="mt-3 text-sm leading-relaxed text-muted">{option.mainBenefit}</p>}
              <Link
                href={`/familia/nueva-reserva?repeat=${encodeURIComponent(option.id)}`}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Pedir este paseo <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-xs text-muted">
          Precios en pesos mexicanos. El pago se acuerda al agendar.
        </p>
      </div>
    </section>
  )
}
