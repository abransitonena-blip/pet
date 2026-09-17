'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/firebase/db'
import { AlertTriangle, MapPinOff, MessageSquare, Star, XCircle } from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import { useOpenGeofenceAlerts } from '@/lib/useInsightSignals'
import { CANCELLED_STATUSES, STATUS_LABELS } from '@/lib/businessMetrics'
import { formatShortDate, mexicoCityToday } from '@/lib/customerSegments'
import { shiftDate } from '@/lib/insights'

/**
 * Incidencias para el supervisor.
 *
 * This page used to list the latest reviews and call low ratings "incidencias".
 * A review is an opinion written days later, not an incident: what a supervisor
 * has to see is a walker outside the zone, an incident the walker wrote in the
 * report, and walks that ended cancelled or with nobody there. Reviews stay, as
 * what they are, at the end.
 *
 * Everything is read-only here; acting on an alert happens in Rutas or in
 * Solicitudes y paseos.
 */

const RECENT_DAYS = 30
const MAX_SESSIONS = 100
const MAX_REPORTS = 100
const MAX_REVIEWS = 30
const LOW_RATING = 3

interface ReportIncident {
  id: string
  sessionId: string
  incident: string
  status: string
}

interface ReviewRow {
  id: string
  rating: number
  comment: string
}

function Section({ title, count, icon, children }: { title: string; count: number; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted" aria-hidden="true">{icon}</span>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-2xs text-muted">{count}</span>
      </div>
      {children}
    </section>
  )
}

export default function SupervisorIncidencias() {
  const today = mexicoCityToday()
  const since = shiftDate(today, -(RECENT_DAYS - 1))
  const { reservations, loading, error, retry } = useCanonicalReservations({ max: MAX_SESSIONS })
  const openAlerts = useOpenGeofenceAlerts()
  const [reports, setReports] = useState<ReportIncident[] | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null)

  useEffect(() => onSnapshot(
    query(collection(db, 'walkReports'), orderBy('updatedAt', 'desc'), limit(MAX_REPORTS)),
    (snapshot) => {
      setReports(snapshot.docs.flatMap((item) => {
        const data = item.data()
        const incident = typeof data.incidentsSummary === 'string' ? data.incidentsSummary.trim() : ''
        if (!incident) return []
        return [{
          id: item.id,
          sessionId: typeof data.walkSessionId === 'string' ? data.walkSessionId : item.id,
          incident,
          status: typeof data.status === 'string' ? data.status : 'draft',
        }]
      }))
    },
    () => setReports(null),
  ), [])

  useEffect(() => onSnapshot(
    query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(MAX_REVIEWS)),
    (snapshot) => {
      setReviews(snapshot.docs.flatMap((item) => {
        const data = item.data()
        const rating = typeof data.rating === 'number' ? data.rating : null
        if (rating === null || rating > LOW_RATING) return []
        return [{ id: item.id, rating, comment: typeof data.comment === 'string' ? data.comment : '' }]
      }))
    },
    () => setReviews(null),
  ), [])

  const failedWalks = useMemo(() => reservations
    .filter((session) => CANCELLED_STATUSES.has(session.status) && session.date >= since && session.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date)), [reservations, since, today])

  const sessionsById = useMemo(() => new Map(reservations.map((session) => [session.id, session])), [reservations])
  const alerts = openAlerts ?? []
  const reportIncidents = reports ?? []
  const lowRatings = reviews ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidencias"
        description="Alertas de zona, incidencias escritas por el paseador y paseos que no salieron bien. Solo lectura."
        icon={<AlertTriangle size={20} />}
      />

      <Section title="Alertas de zona sin revisar" count={alerts.length} icon={<MapPinOff size={14} />}>
        {openAlerts === null ? (
          <Card className="p-4 shadow-none"><p className="text-xs text-muted">No pudimos consultar las alertas de zona.</p></Card>
        ) : alerts.length === 0 ? (
          <Card className="p-4 shadow-none"><p className="text-xs text-muted">Ningún paseador salió de su zona sin revisar.</p></Card>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li key={alert.sessionId} className="rounded-xl border border-ink/10 bg-surface p-4 text-xs shadow-sm">
                <p className="text-sm font-semibold text-ink">{alert.walkerName}</p>
                <p className="text-muted">
                  {[alert.zoneName ? `Zona ${alert.zoneName}` : '', alert.distanceMeters !== null ? `a ${alert.distanceMeters} m del centro` : '']
                    .filter(Boolean).join(' · ') || 'Fuera de la zona del paseo'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Incidencias escritas por el paseador" count={reportIncidents.length} icon={<MessageSquare size={14} />}>
        {reports === null ? (
          <Card className="p-4 shadow-none"><p className="text-xs text-muted">No pudimos consultar los reportes de paseo.</p></Card>
        ) : reportIncidents.length === 0 ? (
          <Card className="p-4 shadow-none"><p className="text-xs text-muted">Ningún reporte reciente registra una incidencia.</p></Card>
        ) : (
          <ul className="space-y-2">
            {reportIncidents.map((report) => {
              const session = sessionsById.get(report.sessionId)
              return (
                <li key={report.id} className="rounded-xl border border-ink/10 bg-surface p-4 text-xs shadow-sm">
                  <p className="whitespace-pre-wrap text-sm text-ink">{report.incident}</p>
                  <p className="mt-1 text-muted">
                    {[
                      session ? `${formatShortDate(session.date)} · ${session.petName || 'Perro sin nombre'}` : 'Paseo fuera del periodo cargado',
                      session?.walkerName || '',
                      report.status === 'submitted' ? 'Reporte enviado' : 'Reporte en borrador',
                    ].filter(Boolean).join(' · ')}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title={`Paseos cancelados o sin presentarse (${RECENT_DAYS} días)`} count={failedWalks.length} icon={<XCircle size={14} />}>
        {error ? (
          <Card className="p-4 shadow-none"><ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} /></Card>
        ) : loading ? (
          <LoadingState rows={2} height="h-14" />
        ) : failedWalks.length === 0 ? (
          <Card className="p-4 shadow-none"><p className="text-xs text-muted">Ningún paseo se canceló ni quedó sin presentarse en este periodo.</p></Card>
        ) : (
          <ul className="space-y-2">
            {failedWalks.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-surface p-4 text-xs shadow-sm">
                <span>
                  <span className="text-sm font-semibold text-ink">{formatShortDate(session.date)}</span>
                  <span className="ml-2 text-muted">{[session.petName || 'Perro sin nombre', session.name || 'Familia sin nombre'].join(' · ')}</span>
                </span>
                <span className="text-muted">{STATUS_LABELS[session.status] ?? session.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Reseñas de ${LOW_RATING} estrellas o menos`} count={lowRatings.length} icon={<Star size={14} />}>
        {reviews === null ? (
          <Card className="p-4 shadow-none"><p className="text-xs text-muted">No pudimos consultar las reseñas.</p></Card>
        ) : lowRatings.length === 0 ? (
          <EmptyState icon={<Star size={20} />} title="Sin reseñas bajas" description="Ninguna reseña reciente tiene 3 estrellas o menos." />
        ) : (
          <ul className="space-y-2">
            {lowRatings.map((review) => (
              <li key={review.id} className="rounded-xl border border-ink/10 bg-surface p-4 text-xs shadow-sm">
                <p className="text-sm font-medium text-ink">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
                <p className="mt-0.5 text-muted">{review.comment || 'Sin comentario'}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
