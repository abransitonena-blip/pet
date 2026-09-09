'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot, limit as fsLimit, type FirestoreError } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { MapPinned, Dog, User, Navigation, Filter } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Card from '@/components/ui/Card'
import { formatWalkPoint, mapsUrlForPoint } from '@/lib/walkLocation'
import { canonicalReadErrorMessage, classifyCanonicalReadError, type CanonicalReadError } from '@/lib/useCanonicalWalkSessions'
import type { WalkPoint } from '@/types'

/**
 * Dónde empezó y terminó cada paseo.
 *
 * This page used to read GPS coordinates off the legacy `reservations`
 * documents, a collection nothing writes to anymore, so it only ever showed
 * walks from before the migration. The canonical sessions now carry a start
 * and an end point, captured by the walker's phone when they press "Iniciar
 * paseo" and "Completar paseo".
 *
 * There is no route line: only those two points are recorded, so drawing a
 * path between them would show a journey nobody measured.
 */

const MAX_SESSIONS = 200

interface RouteRow {
  id: string
  walkerId: string
  scheduledDate: string
  startLocation?: WalkPoint
  endLocation?: WalkPoint
  startedAt?: { seconds: number }
  completedAt?: { seconds: number }
}

function point(value: unknown): WalkPoint | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = value as Record<string, unknown>
  return typeof data.lat === 'number' && typeof data.lng === 'number'
    ? { lat: data.lat, lng: data.lng, accuracy: typeof data.accuracy === 'number' ? data.accuracy : 0 }
    : undefined
}

function seconds(value: unknown): { seconds: number } | undefined {
  return value && typeof value === 'object' && typeof (value as { seconds?: unknown }).seconds === 'number'
    ? { seconds: (value as { seconds: number }).seconds }
    : undefined
}

function straightLineDistance(from: WalkPoint, to: WalkPoint): number {
  const R = 6371e3
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatDuration(row: RouteRow): string {
  if (!row.startedAt || !row.completedAt) return '—'
  const minutes = Math.floor((row.completedAt.seconds - row.startedAt.seconds) / 60)
  if (minutes < 0) return '—'
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export default function AdminRutasPage() {
  const [rows, setRows] = useState<RouteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<CanonicalReadError | null>(null)
  const [filterWalker, setFilterWalker] = useState('all')

  useEffect(() => {
    const sessionsQuery = query(
      collection(db, 'walkSessions'),
      orderBy('scheduledDate', 'desc'),
      fsLimit(MAX_SESSIONS),
    )
    return onSnapshot(sessionsQuery, (snapshot) => {
      setRows(snapshot.docs.flatMap((item) => {
        const data = item.data()
        const startLocation = point(data.startLocation)
        const endLocation = point(data.endLocation)
        // A session without either point has nothing to show on this page.
        if (!startLocation && !endLocation) return []
        return [{
          id: item.id,
          walkerId: typeof data.walkerId === 'string' ? data.walkerId : '',
          scheduledDate: typeof data.scheduledDate === 'string' ? data.scheduledDate : '',
          startLocation,
          endLocation,
          startedAt: seconds(data.startedAt),
          completedAt: seconds(data.completedAt),
        }]
      }))
      setError(null)
      setLoading(false)
    }, (cause: FirestoreError) => {
      setError(classifyCanonicalReadError(cause))
      setLoading(false)
    })
  }, [])

  const walkers = useMemo(
    () => Array.from(new Set(rows.map((row) => row.walkerId).filter(Boolean))),
    [rows],
  )

  const filtered = useMemo(
    () => (filterWalker === 'all' ? rows : rows.filter((row) => row.walkerId === filterWalker)),
    [rows, filterWalker],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ubicación de los paseos"
        description={`${rows.length} paseos con ubicación registrada · inicio y fin, sin recorrido intermedio`}
      />

      {walkers.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={13} className="text-muted" aria-hidden="true" />
          <button
            onClick={() => setFilterWalker('all')}
            className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors ${filterWalker === 'all' ? 'bg-brand-500/15 text-brand-600' : 'bg-ink/5 text-muted'}`}
          >
            Todos
          </button>
          {walkers.map((walkerId) => (
            <button
              key={walkerId}
              onClick={() => setFilterWalker(walkerId)}
              className={`min-h-9 rounded-lg px-3 font-mono text-2xs transition-colors ${filterWalker === walkerId ? 'bg-brand-500/15 text-brand-600' : 'bg-ink/5 text-muted'}`}
            >
              {walkerId.slice(0, 8)}…
            </button>
          ))}
        </div>
      )}

      {error ? (
        <Card className="p-4 shadow-none">
          <ErrorState description={canonicalReadErrorMessage(error)} />
        </Card>
      ) : loading ? (
        <LoadingState rows={3} height="h-24" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MapPinned size={24} />}
          title="Todavía no hay paseos con ubicación"
          description="La ubicación se guarda cuando el paseador marca «Iniciar paseo» y «Completar paseo» desde su teléfono, y solo si concede el permiso de ubicación."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const distance = row.startLocation && row.endLocation
              ? straightLineDistance(row.startLocation, row.endLocation)
              : null

            return (
              <Card key={row.id} className="p-4 shadow-none">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Dog size={14} className="text-muted" aria-hidden="true" />
                    <span className="font-semibold text-ink">{row.scheduledDate || 'Sin fecha'}</span>
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <User size={11} aria-hidden="true" />
                      <span className="font-mono">{row.walkerId ? `${row.walkerId.slice(0, 8)}…` : 'Sin paseador'}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>Duración: {formatDuration(row)}</span>
                    {/* Straight-line, and labelled as such: with only two points
                        the real walked distance is unknown. */}
                    {distance !== null && (
                      <span className="flex items-center gap-1">
                        <Navigation size={11} aria-hidden="true" />
                        {formatDistance(distance)} en línea recta
                      </span>
                    )}
                  </div>
                </div>

                <dl className="grid gap-2 sm:grid-cols-2">
                  {(['startLocation', 'endLocation'] as const).map((field) => {
                    const value = row[field]
                    return (
                      <div key={field} className="rounded-xl bg-ink/[0.03] px-3 py-2">
                        <dt className="text-2xs font-medium uppercase tracking-wide text-muted">
                          {field === 'startLocation' ? 'Inicio' : 'Fin'}
                        </dt>
                        <dd className="mt-0.5 text-xs text-ink">
                          {value ? (
                            <a
                              href={mapsUrlForPoint(value)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              {formatWalkPoint(value)}
                            </a>
                          ) : 'Sin ubicación registrada'}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
