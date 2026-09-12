'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { CheckCircle2, Mailbox, MapPinned, Search } from 'lucide-react'
import { db } from '@/firebase/config'
import { getWhatsAppLink } from '@/lib/utils'
import { BRAND } from '@/lib/brand'
import { normalizePostalCode, zoneForPostalCode } from '@/lib/zoneMatching'

/**
 * Dónde llega PET Ap, antes de que nadie se registre.
 *
 * La pregunta que una familia se hace primero es "¿me llegan?", y hasta ahora
 * sólo podía responderla registrándose y capturando su dirección. Aquí escribe
 * su código postal y lo sabe: las zonas y sus CP son los mismos que usa el
 * panel para asignar la dirección, así que lo que dice esta sección es lo que
 * de verdad va a pasar.
 *
 * Cada consulta se registra -- sólo el código postal, nada de quién preguntó --
 * para que administración vea qué colonias le están pidiendo. Si eso falla, no
 * se le dice nada a la familia: su respuesta no depende del contador.
 */

interface CoverageZone {
  id: string
  name: string
  active: boolean
  postalCodes: string[]
}

export default function CoverageSection() {
  const [zones, setZones] = useState<CoverageZone[]>([])
  const [postalCode, setPostalCode] = useState('')
  const reported = useRef<Set<string>>(new Set())

  useEffect(() => onSnapshot(
    query(collection(db, 'zones'), where('active', '==', true), limit(100)),
    (snapshot) => {
      setZones(snapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          name: String(data.name || item.id),
          active: data.active !== false,
          postalCodes: Array.isArray(data.postalCodes)
            ? data.postalCodes.filter((code: unknown): code is string => typeof code === 'string')
            : [],
        }
      }))
    },
    () => setZones([]),
  ), [])

  const typed = normalizePostalCode(postalCode)
  const match = useMemo(() => zoneForPostalCode(zones, postalCode), [zones, postalCode])
  const withCodes = zones.filter((zone) => zone.postalCodes.length > 0)

  // Se registra una sola vez por código completo, cuando la persona termina de
  // escribirlo: no una por tecla mientras lo teclea.
  useEffect(() => {
    if (!typed || reported.current.has(typed)) return
    reported.current.add(typed)
    const timer = window.setTimeout(() => {
      void fetch('/api/coverage/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postalCode: typed }),
      }).catch(() => { /* el contador es nuestro, no un problema de la familia */ })
    }, 800)
    return () => window.clearTimeout(timer)
  }, [typed])

  if (zones.length === 0) return null

  return (
    <section aria-labelledby="coverage-title" id="cobertura" className="scroll-mt-20 py-16 sm:py-24">
      <div className="section-container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium uppercase tracking-widest text-primary-hover">Cobertura</span>
          <h2 id="coverage-title" className="section-title mt-3">¿Llegamos a tu <span className="text-primary">colonia</span>?</h2>
          <p className="section-subtitle">Escribe tu código postal y te decimos si ya paseamos por ahí.</p>
        </div>

        <div className="mx-auto mt-8 max-w-md">
          <label htmlFor="coverage-postal-code" className="sr-only">Código postal</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} aria-hidden="true" />
            <Mailbox className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40" size={16} aria-hidden="true" />
            <input
              id="coverage-postal-code"
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              placeholder="Tu código postal, por ejemplo 06700"
              className="input-field pl-11 text-center text-lg tracking-[0.2em]"
            />
          </div>

          {typed && match && (
            <p role="status" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-success-500/10 px-4 py-3 text-sm font-medium text-success-600">
              <CheckCircle2 size={16} aria-hidden="true" />
              Sí llegamos: tu CP {typed} está en la zona {match.name}.
            </p>
          )}

          {typed && !match && (
            <p role="status" className="mt-3 rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-900">
              Todavía no tenemos una zona con el CP {typed}.{' '}
              <a
                href={getWhatsAppLink(`Hola, mi código postal es ${typed}. ¿Tienen cobertura para pasear a mi perro?`)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                Pregúntanos por WhatsApp
              </a>{' '}
              y te decimos si podemos llegar.
            </p>
          )}
        </div>

        {withCodes.length > 0 && (
          <ul className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
            {withCodes.map((zone) => (
              <li key={zone.id} className="rounded-2xl border border-ink/10 bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <MapPinned size={15} className="text-primary" aria-hidden="true" /> {zone.name}
                </p>
                <p className="mt-1 text-xs text-muted">CP {zone.postalCodes.join(' · ')}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-center text-xs text-muted">
          ¿Tu colonia no aparece? Escríbenos a {BRAND.name} y lo revisamos contigo.
        </p>
      </div>
    </section>
  )
}
