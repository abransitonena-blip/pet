'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { Camera, FileText } from 'lucide-react'
import { auth, db } from '@/firebase/config'
import { Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import WalkPhotos from '@/components/walker/WalkPhotos'
import { canonicalReadErrorMessage, useCustomerWalkSessions } from '@/lib/useCanonicalWalkSessions'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { formatShortDate } from '@/lib/customerSegments'
import { isWalkPhotoReference } from '@/lib/walkReports'

/**
 * Fotos y reporte de cada paseo terminado.
 *
 * Photos are private: a report stores opaque references and WalkPhotos asks
 * the server for links that expire in minutes. A family can read a report only
 * once the walker has sent it, so a walk whose report is still a draft reads
 * "Reporte en preparación" -- not "Sin fotos", which would be false.
 *
 * Only the most recent walks with photos show them inline, which keeps the
 * signed-link requests per visit small; every walk links to its full report.
 */

const INLINE_PHOTO_WALKS = 6
const REPORT_LOOKUPS = 20

type ReportSummary = { state: 'sent'; photos: string[] } | { state: 'pending' }

export default function FotosPage() {
  const router = useRouter()
  const [uid, setUid] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const { sessions, loading, error, retry } = useCustomerWalkSessions(uid)
  const [reports, setReports] = useState<Record<string, ReportSummary>>({})

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      setUid(user.uid)
      setCheckingAuth(false)
    })
  }, [router])

  const completed = sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => (b.scheduledDate ?? '').localeCompare(a.scheduledDate ?? ''))
  const lookupKey = completed.slice(0, REPORT_LOOKUPS).map((session) => session.id).join('|')

  useEffect(() => {
    if (!lookupKey || !FEATURE_FLAGS.WALK_REPORTS_ENABLED) return
    let cancelled = false
    Promise.all(lookupKey.split('|').map(async (sessionId): Promise<[string, ReportSummary]> => {
      try {
        const snapshot = await getDoc(doc(db, 'walkReports', sessionId))
        const data = snapshot.exists() ? snapshot.data() : null
        if (!data || data.status !== 'submitted') return [sessionId, { state: 'pending' }]
        const photos = Array.isArray(data.mediaReferences)
          ? data.mediaReferences.filter((value: unknown): value is string => typeof value === 'string' && isWalkPhotoReference(value))
          : []
        return [sessionId, { state: 'sent', photos }]
      } catch {
        // A draft report is not readable by the family yet.
        return [sessionId, { state: 'pending' }]
      }
    })).then((entries) => {
      if (!cancelled) setReports(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
  }, [lookupKey])

  const inlineIds = new Set(
    completed
      .filter((session) => {
        const report = reports[session.id]
        return report?.state === 'sent' && report.photos.length > 0
      })
      .slice(0, INLINE_PHOTO_WALKS)
      .map((session) => session.id),
  )

  if (checkingAuth || loading) {
    return <LoadingState message="Consultando tus paseos…" rows={3} height="h-16" />
  }

  if (error) {
    return (
      <Card className="p-4 shadow-none">
        <ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Fotos y reportes</h1>
        <p className="mt-1 text-sm text-muted">
          {FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED
            ? 'Las fotos y el reporte de cada paseo aparecen en cuanto el paseador envía su reporte.'
            : 'Las fotos de paseo todavía no están habilitadas. Mientras tanto, cada paseo terminado tiene su reporte escrito por el paseador.'}
        </p>
      </div>

      {completed.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Camera size={28} />}
            title="Todavía no tienes paseos terminados"
            description="Cuando un paseo se complete, sus fotos y su reporte aparecerán aquí."
            action={<Button size="sm" onClick={() => router.push('/familia/nueva-reserva')}>Reservar un paseo</Button>}
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {completed.map((session) => {
            const report = reports[session.id]
            const photos = report?.state === 'sent' ? report.photos : []
            const reportLabel = !report
              ? ''
              : report.state === 'pending'
                ? 'Reporte en preparación'
                : photos.length > 0 ? `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}` : 'Sin fotos'
            return (
              <li key={session.id}>
                <Card className="space-y-3 p-4 shadow-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{formatShortDate(session.scheduledDate) || 'Sin fecha'}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {[session.scheduledStart, reportLabel].filter(Boolean).join(' · ') || 'Sin hora'}
                      </p>
                    </div>
                    <Link
                      href={`/familia/reportes/${encodeURIComponent(session.id)}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <FileText size={15} aria-hidden="true" /> Ver reporte
                    </Link>
                  </div>
                  {FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED && inlineIds.has(session.id) && (
                    <WalkPhotos sessionId={session.id} references={photos} />
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
