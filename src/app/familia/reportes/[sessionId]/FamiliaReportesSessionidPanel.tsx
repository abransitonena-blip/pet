'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { MapPin } from 'lucide-react'
import { db } from '@/firebase/db'
import { Card, ErrorState, LoadingState } from '@/components/ui'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { useWalkReport } from '@/lib/useWalkReport'
import { ReportReadOnly } from '@/components/walker/WalkReportEditor'
import WalkRouteMap from '@/components/walks/WalkRouteMap'
import WalkerCard from '@/components/family/WalkerCard'
import RateWalker from '@/components/family/RateWalker'
import { useWalkerPhoto } from '@/lib/useWalkerPhoto'
import type { WalkPoint } from '@/types'

function millis(value: unknown): number | null {
  const stamp = value as { seconds?: unknown } | undefined
  return typeof stamp?.seconds === 'number' ? stamp.seconds * 1000 : null
}

function formatHour(at: number | null): string {
  if (at === null) return 'Hora no registrada'
  return new Date(at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function point(value: unknown): WalkPoint | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = value as Record<string, unknown>
  if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return undefined
  return { lat: data.lat, lng: data.lng, accuracy: typeof data.accuracy === 'number' ? data.accuracy : 0 }
}

/**
 * Dónde empezó y terminó el paseo, junto al reporte.
 *
 * Read straight from the session rather than from the report: the walker's
 * phone writes the two points as part of the state transition, so they exist
 * even for a walk whose written report is still a draft.
 *
 * Las coordenadas ya no se muestran: un par de números no le dice a nadie por
 * dónde anduvo su perro. Lo que se ve es la hora de cada momento, y el mapa del
 * recorrido debajo.
 */
function WalkLocations({ sessionId }: { sessionId: string }) {
  const [times, setTimes] = useState<{ start?: WalkPoint; end?: WalkPoint; startedAt: number | null; completedAt: number | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, 'walkSessions', sessionId))
      .then((snapshot) => {
        if (cancelled || !snapshot.exists()) return
        const data = snapshot.data()
        setTimes({
          start: point(data.startLocation),
          end: point(data.endLocation),
          startedAt: millis(data.startedAt),
          completedAt: millis(data.completedAt),
        })
      })
      .catch(() => { /* the report itself is the point of this page */ })
    return () => { cancelled = true }
  }, [sessionId])

  if (!times?.start && !times?.end) return null

  return (
    <Card className="mt-3 p-4 shadow-none">
      <h2 className="text-sm font-semibold text-ink">Horario del paseo</h2>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {([['Empezó', times.start, times.startedAt], ['Terminó', times.end, times.completedAt]] as const).map(([label, place, at]) => (
          <div key={label} className="rounded-xl bg-ink/[0.03] px-3 py-2">
            <dt className="text-2xs font-medium uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-0.5 flex items-center gap-1 text-xs text-ink">
              <MapPin size={11} className="text-muted" aria-hidden="true" />
              {place ? formatHour(at) : 'Sin registrar'}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

/**
 * Calificar al paseador de este paseo.
 *
 * Sólo tiene sentido en un paseo terminado y con paseador: las reglas lo
 * comprueban igual, pero ofrecer el formulario cuando no se puede enviar sería
 * prometer algo que va a fallar.
 */
function RateThisWalk({ sessionId }: { sessionId: string }) {
  const [walk, setWalk] = useState<{ walkerId: string; completed: boolean } | null>(null)
  const walker = useWalkerPhoto({ sessionId })

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, 'walkSessions', sessionId))
      .then((snapshot) => {
        if (cancelled || !snapshot.exists()) return
        const data = snapshot.data()
        setWalk({
          walkerId: typeof data.walkerId === 'string' ? data.walkerId : '',
          completed: data.status === 'completed',
        })
      })
      .catch(() => { /* sin sesión no se ofrece calificar */ })
    return () => { cancelled = true }
  }, [sessionId])

  if (!walk?.completed || !walk.walkerId) return null

  return (
    <div className="mt-3">
      <RateWalker sessionId={sessionId} walkerId={walk.walkerId} walkerName={walker?.name ?? 'tu paseador'} />
    </div>
  )
}

export default function FamilyReportPage() {
  const params = useParams<{ sessionId: string }>()
  const { report, state } = useWalkReport(params.sessionId)
  if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED || state === 'unavailable') return <Card className="p-5 shadow-none"><p className="font-semibold text-ink">Reporte no disponible</p><p className="mt-1 text-sm text-muted">Los reportes canónicos todavía no están habilitados.</p></Card>
  if (state === 'loading') return <LoadingState message="Consultando reporte…" rows={3} />
  if (state === 'permission-denied') return <ErrorState description="No tienes permiso para consultar este reporte." />
  if (state === 'network-error') return <ErrorState description="No pudimos consultar el reporte. Revisa tu conexión." />
  if (!report || report.status !== 'submitted') {
    return (
      <div>
        <Card className="p-5 shadow-none">
          <p className="font-semibold text-ink">Aún no hay reporte</p>
          <p className="mt-1 text-sm text-muted">El reporte aparecerá cuando el paseador lo envíe.</p>
        </Card>
        <WalkLocations sessionId={params.sessionId} />
        <WalkRouteMap sessionId={params.sessionId} />
      </div>
    )
  }
  return (
    <div>
      {/* Quién lo llevó: cara y nombre junto a lo que escribió. */}
      <div className="mb-3"><WalkerCard sessionId={params.sessionId} /></div>
      <ReportReadOnly report={report} sessionId={params.sessionId} />
      <WalkLocations sessionId={params.sessionId} />
      <WalkRouteMap sessionId={params.sessionId} />
      <RateThisWalk sessionId={params.sessionId} />
    </div>
  )
}
