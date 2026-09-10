'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { MapPin } from 'lucide-react'
import { db } from '@/firebase/config'
import { Card, ErrorState, LoadingState } from '@/components/ui'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { useWalkReport } from '@/lib/useWalkReport'
import { ReportReadOnly } from '@/components/walker/WalkReportEditor'
import { formatWalkPoint, mapsUrlForPoint } from '@/lib/walkLocation'
import type { WalkPoint } from '@/types'

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
 */
function WalkLocations({ sessionId }: { sessionId: string }) {
  const [points, setPoints] = useState<{ start?: WalkPoint; end?: WalkPoint } | null>(null)

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, 'walkSessions', sessionId))
      .then((snapshot) => {
        if (cancelled || !snapshot.exists()) return
        const data = snapshot.data()
        setPoints({ start: point(data.startLocation), end: point(data.endLocation) })
      })
      .catch(() => { /* the report itself is the point of this page */ })
    return () => { cancelled = true }
  }, [sessionId])

  if (!points?.start && !points?.end) return null

  return (
    <Card className="mt-3 p-4 shadow-none">
      <h2 className="text-sm font-semibold text-ink">Ubicación del paseo</h2>
      <p className="mt-0.5 text-xs text-muted">Solo se registran el inicio y el final, no el recorrido.</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {([['Inicio', points.start], ['Fin', points.end]] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-ink/[0.03] px-3 py-2">
            <dt className="text-2xs font-medium uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-0.5 text-xs text-ink">
              {value ? (
                <a
                  href={mapsUrlForPoint(value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <MapPin size={11} aria-hidden="true" /> {formatWalkPoint(value)}
                </a>
              ) : 'Sin ubicación registrada'}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
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
      </div>
    )
  }
  return (
    <div>
      <ReportReadOnly report={report} sessionId={params.sessionId} />
      <WalkLocations sessionId={params.sessionId} />
    </div>
  )
}
