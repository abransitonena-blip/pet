'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collection, doc, getDocs, limit as fsLimit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type FirestoreError,
} from 'firebase/firestore'
import { AlertTriangle, Dog, Filter, MapPinned, Navigation, User } from 'lucide-react'
import { auth, db } from '@/firebase/config'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import ZoneMap, { type MapPoint, type MapZone } from '@/components/map/ZoneMap'
import { distanceMeters, isUsableCenter } from '@/lib/geo'
import { mapsUrlForPoint } from '@/lib/walkLocation'
import { summarizeWalkPath } from '@/lib/walkPath'
import { canonicalReadErrorMessage, classifyCanonicalReadError, type CanonicalReadError } from '@/lib/useCanonicalWalkSessions'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import type { WalkPoint } from '@/types'

/**
 * Ubicación de los paseos: alertas de zona, recorrido y puntos de inicio/fin.
 *
 * During a walk in progress the walker's phone reports a point every ~2
 * minutes (owner decision) and the server raises an alert if it is outside
 * the walk's zone.
 *
 * El recorrido se dibuja como una línea punteada entre esas lecturas: quien
 * despacha necesita ver por dónde anduvo el paseo, no una lista de coordenadas.
 * Punteada, y con la distancia llamada "aproximada", porque entre dos lecturas
 * nadie registró el camino -- la línea une lo que sí se midió, no lo inventa.
 */

// firestore.rules only lets a walkSessions list ask for 100 (validListLimit);
// a bigger limit is rejected as permission-denied, not trimmed.
const MAX_SESSIONS = 100
const MAX_ALERTS = 30
const MAX_POINTS = 300

interface RouteRow {
  id: string
  walkerId: string
  scheduledDate: string
  startLocation?: WalkPoint
  endLocation?: WalkPoint
  startedAt?: { seconds: number }
  completedAt?: { seconds: number }
}

interface AlertRow {
  id: string
  walkerName: string
  zoneName: string
  zoneCenter: { lat: number; lng: number } | null
  radiusKm: number | null
  status: 'open' | 'acknowledged'
  distanceMeters: number | null
  outsideCount: number
  lastOutsideAt: number | null
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

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatDuration(row: RouteRow): string {
  if (!row.startedAt || !row.completedAt) return '—'
  const minutes = Math.floor((row.completedAt.seconds - row.startedAt.seconds) / 60)
  if (minutes < 0) return '—'
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

function formatTime(ms: number | null): string {
  if (ms === null) return '—'
  return new Date(ms).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminRutasPage() {
  const [rows, setRows] = useState<RouteRow[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<CanonicalReadError | null>(null)
  const [filterWalker, setFilterWalker] = useState('all')
  const [selected, setSelected] = useState<{ sessionId: string; title: string; zone: MapZone | null; start?: WalkPoint; end?: WalkPoint } | null>(null)
  const [track, setTrack] = useState<{ state: 'idle' | 'loading' | 'ready' | 'error'; points: MapPoint[] }>({ state: 'idle', points: [] })

  useEffect(() => {
    const sessionsQuery = query(collection(db, 'walkSessions'), orderBy('scheduledDate', 'desc'), fsLimit(MAX_SESSIONS))
    return onSnapshot(sessionsQuery, (snapshot) => {
      setRows(snapshot.docs.flatMap((item) => {
        const data = item.data()
        const startLocation = point(data.startLocation)
        const endLocation = point(data.endLocation)
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

  useEffect(() => {
    if (!FEATURE_FLAGS.WALK_TRACKING_ENABLED) return
    return onSnapshot(
      query(collection(db, 'geofenceAlerts'), orderBy('lastOutsideAt', 'desc'), fsLimit(MAX_ALERTS)),
      (snapshot) => setAlerts(snapshot.docs.map((item) => {
        const data = item.data()
        const center = data.zoneCenter
        return {
          id: item.id,
          walkerName: typeof data.walkerName === 'string' ? data.walkerName : 'Paseador',
          zoneName: typeof data.zoneName === 'string' ? data.zoneName : '',
          zoneCenter: isUsableCenter(center) ? { lat: center.lat, lng: center.lng } : null,
          radiusKm: typeof data.radiusKm === 'number' ? data.radiusKm : null,
          status: data.status === 'open' ? 'open' : 'acknowledged',
          distanceMeters: typeof data.distanceMeters === 'number' ? data.distanceMeters : null,
          outsideCount: typeof data.outsideCount === 'number' ? data.outsideCount : 1,
          lastOutsideAt: typeof data.lastOutsideAt?.seconds === 'number' ? data.lastOutsideAt.seconds * 1000 : null,
        }
      })),
      () => setAlerts([]),
    )
  }, [])

  useEffect(() => {
    if (!selected) {
      setTrack({ state: 'idle', points: [] })
      return
    }
    let cancelled = false
    setTrack({ state: 'loading', points: [] })
    getDocs(query(collection(db, 'walkTracks', selected.sessionId, 'points'), orderBy('capturedAt', 'asc'), fsLimit(MAX_POINTS)))
      .then((snapshot) => {
        if (cancelled) return
        setTrack({
          state: 'ready',
          points: snapshot.docs.flatMap((item) => {
            const data = item.data()
            if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return []
            const at = typeof data.capturedAt?.seconds === 'number' ? data.capturedAt.seconds * 1000 : null
            return [{ lat: data.lat, lng: data.lng, outside: data.outside === true, label: `${formatTime(at)}${data.outside === true ? ' · fuera de zona' : ''}` }]
          }),
        })
      })
      .catch(() => { if (!cancelled) setTrack({ state: 'error', points: [] }) })
    return () => { cancelled = true }
  }, [selected])

  const acknowledge = async (id: string) => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    await updateDoc(doc(db, 'geofenceAlerts', id), { status: 'acknowledged', acknowledgedBy: uid, acknowledgedAt: serverTimestamp() }).catch(() => {})
  }

  // El inicio y el fin son lecturas del mismo teléfono, así que entran en el
  // recorrido: son el primer y el último punto de la línea.
  const routePath = useMemo(() => {
    if (!selected) return []
    return [
      ...(selected.start ? [{ lat: selected.start.lat, lng: selected.start.lng }] : []),
      ...track.points.map((item) => ({ lat: item.lat, lng: item.lng, outside: item.outside })),
      ...(selected.end ? [{ lat: selected.end.lat, lng: selected.end.lng }] : []),
    ]
  }, [selected, track.points])
  const routeSummary = useMemo(() => summarizeWalkPath(routePath), [routePath])

  const walkers = useMemo(() => Array.from(new Set(rows.map((row) => row.walkerId).filter(Boolean))), [rows])
  const filtered = useMemo(() => (filterWalker === 'all' ? rows : rows.filter((row) => row.walkerId === filterWalker)), [rows, filterWalker])
  const selectedZones = useMemo(() => (selected?.zone ? [selected.zone] : []), [selected])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ubicación de los paseos"
        description="Alertas de zona, recorrido cada ~2 minutos durante el paseo, e inicio y fin"
      />

      {FEATURE_FLAGS.WALK_TRACKING_ENABLED && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Alertas de zona</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted">Ningún paseador ha salido de la zona de su paseo.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <Card className="flex flex-wrap items-center gap-3 p-4 shadow-none">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${alert.status === 'open' ? 'bg-danger-500/10 text-red-700' : 'bg-ink/5 text-muted'}`}>
                      <AlertTriangle size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">
                        {alert.walkerName} · {alert.zoneName || 'Zona sin nombre'}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-2xs font-medium ${alert.status === 'open' ? 'bg-danger-500/10 text-red-700' : 'bg-ink/5 text-muted'}`}>
                          {alert.status === 'open' ? 'Abierta' : 'Enterado'}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {alert.distanceMeters !== null ? `A ${formatDistance(alert.distanceMeters)} del centro` : 'Distancia no disponible'}
                        {alert.radiusKm !== null ? ` · radio ${alert.radiusKm} km` : ''}
                        {` · ${alert.outsideCount} lectura${alert.outsideCount === 1 ? '' : 's'} fuera · última ${formatTime(alert.lastOutsideAt)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelected({
                          sessionId: alert.id,
                          title: `${alert.walkerName} · ${alert.zoneName}`,
                          zone: alert.zoneCenter && alert.radiusKm !== null
                            ? { id: `zone-${alert.id}`, name: alert.zoneName, center: alert.zoneCenter, radius: alert.radiusKm }
                            : null,
                        })}
                      >
                        Ver recorrido
                      </Button>
                      {alert.status === 'open' && <Button size="sm" onClick={() => void acknowledge(alert.id)}>Enterado</Button>}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {selected && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Recorrido: {selected.title}</h2>
            <button type="button" onClick={() => setSelected(null)} className="min-h-9 rounded-full px-3 text-xs font-medium text-muted hover:text-ink">Cerrar</button>
          </div>
          {track.state === 'loading' && <LoadingState rows={1} height="h-40" />}
          {track.state === 'error' && <p className="text-sm text-red-700">No pudimos cargar los puntos de este paseo.</p>}
          {track.state === 'ready' && (
            routePath.length === 0 ? (
              <p className="text-sm text-muted">Este paseo no tiene ubicaciones registradas.</p>
            ) : (
              <>
                <ZoneMap
                  label={`Recorrido del paseo ${selected.title}`}
                  zones={selectedZones}
                  points={track.points}
                  path={routePath}
                  height={320}
                />
                <p className="text-xs text-muted">
                  {routeSummary.label}.{' '}
                  {track.points.length > 0 ? 'Una lectura cada ~2 minutos. ' : ''}
                  Verde: inicio · negro: fin · azul: dentro de la zona · rojo: fuera.
                  {routePath.length > 1 && ' La línea punteada une las lecturas; entre una y otra no se registró el camino.'}
                </p>
              </>
            )
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Inicio y fin de cada paseo</h2>
          {walkers.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <Filter size={13} className="text-muted" aria-hidden="true" />
              <button onClick={() => setFilterWalker('all')} className={`min-h-9 rounded-full px-3 text-xs font-medium ${filterWalker === 'all' ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-muted'}`}>Todos</button>
              {walkers.map((walkerId) => (
                <button key={walkerId} onClick={() => setFilterWalker(walkerId)} className={`min-h-9 rounded-full px-3 font-mono text-2xs ${filterWalker === walkerId ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-muted'}`}>
                  {walkerId.slice(0, 8)}…
                </button>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <Card className="p-4 shadow-none"><ErrorState description={canonicalReadErrorMessage(error)} /></Card>
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
              const distance = row.startLocation && row.endLocation ? distanceMeters(row.startLocation, row.endLocation) : null
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
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span>Duración: {formatDuration(row)}</span>
                      {distance !== null && (
                        <span className="flex items-center gap-1"><Navigation size={11} aria-hidden="true" />{formatDistance(distance)} en línea recta</span>
                      )}
                      {FEATURE_FLAGS.WALK_TRACKING_ENABLED && (
                        <button type="button" onClick={() => setSelected({ sessionId: row.id, title: row.scheduledDate || row.id, zone: null, start: row.startLocation, end: row.endLocation })} className="min-h-9 rounded-full px-3 font-semibold text-primary hover:bg-primary/10">
                          Ver recorrido
                        </button>
                      )}
                    </div>
                  </div>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {([['startLocation', 'Inicio'], ['endLocation', 'Fin']] as const).map(([field, heading]) => {
                      const value = row[field]
                      const at = field === 'startLocation' ? row.startedAt : row.completedAt
                      return (
                        <div key={field} className="rounded-2xl bg-ink/[0.03] px-3 py-2">
                          <dt className="text-2xs font-medium uppercase tracking-wide text-muted">{heading}</dt>
                          <dd className="mt-0.5 text-xs text-ink">
                            {value ? (
                              <>
                                {at ? formatTime(at.seconds * 1000) : 'Hora no registrada'}
                                {' · '}
                                <a href={mapsUrlForPoint(value)} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">
                                  Abrir en mapas
                                </a>
                              </>
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
      </section>
    </div>
  )
}
