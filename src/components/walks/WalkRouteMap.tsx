'use client'

import { useEffect, useState } from 'react'
import { MapPinned } from 'lucide-react'
import Card from '@/components/ui/Card'
import ZoneMap, { type MapPoint } from '@/components/map/ZoneMap'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { summarizeWalkPath } from '@/lib/walkPath'

/**
 * Por dónde caminó su perro.
 *
 * Antes esta parte del reporte eran dos pares de coordenadas, que a una familia
 * no le dicen nada. Ahora es el mapa: la línea une las lecturas que mandó el
 * teléfono del paseador cada ~2 minutos, con el inicio en verde y el fin en
 * negro. Punteada porque entre dos lecturas nadie registró el camino.
 *
 * Los puntos los entrega el servidor, que confirma que quien pregunta tiene algo
 * que ver con ese paseo -- su familia, su paseador o el equipo; el navegador no
 * puede leerlos por su cuenta.
 */

interface RouteState {
  status: 'loading' | 'ready' | 'empty' | 'error'
  path: { lat: number; lng: number }[]
  points: MapPoint[]
}

const EMPTY: RouteState = { status: 'loading', path: [], points: [] }

function formatTime(at: number | null): string {
  if (at === null) return 'Hora no registrada'
  return new Date(at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export default function WalkRouteMap({ sessionId }: { sessionId: string }) {
  const [route, setRoute] = useState<RouteState>(EMPTY)

  useEffect(() => {
    if (!FEATURE_FLAGS.WALK_TRACKING_ENABLED) {
      setRoute({ ...EMPTY, status: 'empty' })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { auth } = await import('@/firebase/config')
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('auth-required')
        const response = await fetch('/api/walks/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ sessionId }),
        })
        const data = await response.json().catch(() => ({})) as {
          points?: Array<{ lat?: unknown; lng?: unknown; outside?: unknown; at?: unknown }>
          start?: { lat: number; lng: number } | null
          end?: { lat: number; lng: number } | null
        }
        if (!response.ok) throw new Error('walk-track-failed')
        if (cancelled) return

        const readings: MapPoint[] = (data.points ?? []).flatMap((item) => {
          if (typeof item.lat !== 'number' || typeof item.lng !== 'number') return []
          const outside = item.outside === true
          const at = typeof item.at === 'number' ? item.at : null
          return [{ lat: item.lat, lng: item.lng, outside, label: `${formatTime(at)}${outside ? ' · fuera de la zona' : ''}` }]
        })
        const path = [
          ...(data.start ? [data.start] : []),
          ...readings.map((item) => ({ lat: item.lat, lng: item.lng, outside: item.outside })),
          ...(data.end ? [data.end] : []),
        ]
        setRoute({ status: path.length === 0 ? 'empty' : 'ready', path, points: readings })
      } catch {
        if (!cancelled) setRoute({ ...EMPTY, status: 'error' })
      }
    })()
    return () => { cancelled = true }
  }, [sessionId])

  if (route.status === 'empty') return null

  const summary = summarizeWalkPath(route.path)

  return (
    <Card className="mt-3 p-4 shadow-none">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <MapPinned size={15} className="text-primary" aria-hidden="true" /> Por dónde caminaron
      </h2>
      {route.status === 'loading' && <div className="skeleton mt-3 h-56 rounded-2xl" />}
      {route.status === 'error' && (
        <p className="mt-1 text-sm text-muted">No pudimos mostrar el recorrido de este paseo.</p>
      )}
      {route.status === 'ready' && (
        <>
          <div className="mt-3">
            <ZoneMap label="Recorrido del paseo" points={route.points} path={route.path} height={260} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {summary.label}. Verde: dónde empezó · negro: dónde terminó.
            {route.path.length > 1 && ' La línea une las lecturas del teléfono, una cada ~2 minutos.'}
          </p>
        </>
      )}
    </Card>
  )
}
