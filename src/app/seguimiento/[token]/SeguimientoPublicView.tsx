'use client'

import { useEffect, useState } from 'react'
import { MapPinned, PawPrint } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import ZoneMap, { type MapPoint } from '@/components/map/ZoneMap'
import { googleMapsRouteUrl, summarizeWalkPath } from '@/lib/walkPath'

/**
 * Lo que ve quien abre el enlace, sin cuenta.
 *
 * Se vuelve a preguntar cada minuto mientras el paseo sigue en curso -- el
 * mismo ritmo que WalkRouteMap -- y se detiene solo cuando ya terminó, porque
 * en ese punto el recorrido no va a cambiar más.
 */

const REFRESH_MS = 60_000

interface ViewData {
  active: boolean
  path: { lat: number; lng: number }[]
  points: MapPoint[]
  expiresAt: number
}

type ViewState = 'loading' | 'ready' | 'not-found' | 'error'

function point(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return typeof data.lat === 'number' && typeof data.lng === 'number' ? { lat: data.lat, lng: data.lng } : null
}

export default function SeguimientoPublicView({ token }: { token: string }) {
  const [data, setData] = useState<ViewData | null>(null)
  const [state, setState] = useState<ViewState>('loading')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch('/api/tracking/share/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (cancelled) return
        if (response.status === 404) {
          setState('not-found')
          clearInterval(timer)
          return
        }
        const result = await response.json().catch(() => ({})) as {
          active?: boolean
          start?: { lat: number; lng: number } | null
          end?: { lat: number; lng: number } | null
          points?: Array<{ lat?: unknown; lng?: unknown }>
          expiresAt?: number
        }
        if (!response.ok) throw new Error('share-view-failed')

        const readings: MapPoint[] = (result.points ?? []).flatMap((item) => {
          const value = point(item)
          return value ? [value] : []
        })
        const path = [
          ...(result.start ? [result.start] : []),
          ...readings,
          ...(result.end ? [result.end] : []),
        ]
        setData({ active: result.active === true, path, points: readings, expiresAt: result.expiresAt ?? 0 })
        setState('ready')
        if (result.active !== true) clearInterval(timer)
      } catch {
        if (!cancelled) setState((current) => current === 'ready' ? current : 'error')
      }
    }

    void load()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [token])

  if (state === 'loading') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
        <p className="text-sm text-muted">Consultando el paseo…</p>
      </main>
    )
  }

  if (state === 'not-found' || state === 'error' || !data) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <PawPrint size={28} className="text-muted" aria-hidden="true" />
        <h1 className="text-lg font-bold text-ink">Este enlace ya no está disponible</h1>
        <p className="text-sm text-muted">
          {state === 'error'
            ? 'No pudimos consultarlo en este momento. Revisa tu conexión e inténtalo de nuevo.'
            : 'Caducó, lo apagaron, o la dirección no es correcta.'}
        </p>
      </main>
    )
  }

  const summary = summarizeWalkPath(data.path)
  const mapsUrl = googleMapsRouteUrl(data.path)

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-12 pt-6">
      <div className="flex items-center justify-center gap-2 text-muted">
        <PawPrint size={18} aria-hidden="true" />
        <span className="text-sm font-semibold">{BRAND.name}</span>
      </div>

      <section className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm">
        <h1 className="flex items-center gap-2 text-base font-bold text-ink">
          {data.active && <span className="animate-live h-2 w-2 shrink-0 rounded-full bg-success-500" aria-hidden="true" />}
          <MapPinned size={16} className="text-primary" aria-hidden="true" />
          {data.active ? 'Paseo en curso' : 'Este paseo ya terminó'}
        </h1>

        {data.path.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Todavía no hay ninguna lectura de este paseo.</p>
        ) : (
          <>
            <div className="mt-3">
              <ZoneMap label="Ubicación compartida del paseo" points={data.points} path={data.path} height={280} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {summary.label}. Verde: dónde empezó{data.path.length > 1 ? ' · negro: dónde va ahora o terminó' : ''}.
            </p>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-xs font-semibold text-primary"
              >
                Abrir en Google Maps
              </a>
            )}
          </>
        )}

        {data.active && (
          <p className="mt-2 text-xs text-muted" aria-live="polite">Esta página se actualiza sola cada minuto.</p>
        )}
      </section>

      <p className="text-center text-2xs text-muted">
        La familia de este paseo de {BRAND.name} compartió este enlace para que lo veas mientras ocurre. Deja de
        funcionar solo, y quien lo compartió puede apagarlo antes.
      </p>
    </main>
  )
}
