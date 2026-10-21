'use client'

import { useCallback, useEffect, useState } from 'react'
import { Dog, FileText, MapPinned, Ticket, User } from 'lucide-react'
import { PageHeader, DataCard, StatusBadge, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { auth } from '@/firebase/config'
import { assignCanonicalWalkSession, CanonicalOperationError } from '@/lib/useCanonicalWalkSessions'
import { isActionableStatus } from '@/lib/zoneAdmin'
import { useFetchWalkersByZone, type ZoneWalker } from '@/lib/useZoneWalkers'

/**
 * Lo que un administrador de zona ve y puede hacer: los paseos de su zona,
 * a quién delegarlos, y si ya tienen reporte o ticket. Nada de nombre,
 * teléfono o dirección de una familia -- eso no viaja hasta aquí, ni en el
 * servidor que arma esta pantalla (ver /api/zone/overview).
 */

interface ZoneSessionRow {
  id: string
  status: string
  scheduledDate: string
  zoneId: string
  zoneName: string
  walkerId: string | null
  walkerName: string | null
  dogCount: number
  reportStatus: string
  hasTicket: boolean
}

type PanelState = 'loading' | 'ready' | 'error' | 'no-zones'

export default function ZonaPanel() {
  const fetchWalkersByZone = useFetchWalkersByZone()
  const [sessions, setSessions] = useState<ZoneSessionRow[]>([])
  const [zoneNames, setZoneNames] = useState<Map<string, string>>(new Map())
  const [state, setState] = useState<PanelState>('loading')
  const [walkersByZone, setWalkersByZone] = useState<Map<string, ZoneWalker[]>>(new Map())
  const [assigning, setAssigning] = useState<string | null>(null)
  const [pickedWalker, setPickedWalker] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('auth-required')
      const response = await fetch('/api/zone/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({}),
      })
      const result = await response.json().catch(() => ({})) as {
        zones?: { id: string; name: string }[]
        sessions?: ZoneSessionRow[]
      }
      if (!response.ok) throw new Error('zone-overview-failed')

      const zones = result.zones ?? []
      setZoneNames(new Map(zones.map((zone) => [zone.id, zone.name])))
      setSessions(result.sessions ?? [])

      if (zones.length === 0) {
        setState('no-zones')
        return
      }

      setWalkersByZone(await fetchWalkersByZone(zones.map((zone) => zone.id)))
      setState('ready')
    } catch {
      setState('error')
    }
  }, [fetchWalkersByZone])

  useEffect(() => { void load() }, [load])

  const handleAssign = async (sessionId: string) => {
    const walkerId = pickedWalker[sessionId]
    if (!walkerId) return
    setAssigning(sessionId)
    setActionError('')
    try {
      await assignCanonicalWalkSession(sessionId, walkerId)
      await load()
    } catch (cause) {
      setActionError(cause instanceof CanonicalOperationError
        ? messageForAssignError(cause.code)
        : 'No pudimos asignar el paseo. Intenta de nuevo.')
    } finally {
      setAssigning(null)
    }
  }

  if (state === 'loading') return <LoadingState message="Consultando tu zona…" rows={4} />

  if (state === 'error') {
    return <ErrorState description="No pudimos consultar tu zona." onRetry={() => void load()} />
  }

  if (state === 'no-zones') {
    return (
      <EmptyState
        icon={<MapPinned size={24} />}
        title="Todavía no tienes zonas asignadas"
        description="Administración debe asignarte al menos una zona para que veas sus paseos."
      />
    )
  }

  const pending = sessions.filter((item) => isActionableStatus(item.status) && !item.walkerId)
  const rest = sessions.filter((item) => !(isActionableStatus(item.status) && !item.walkerId))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi zona"
        description={`Paseos de ${Array.from(zoneNames.values()).join(', ') || 'tu zona'}: a quién delegarlos, y si ya tienen reporte o ticket.`}
        icon={<MapPinned size={20} />}
      />

      {actionError && (
        <p role="alert" className="rounded-xl bg-danger-500/10 px-3 py-2 text-xs text-red-700">{actionError}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Por asignar</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Ningún paseo de tu zona espera paseador.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((session) => {
              const eligible = walkersByZone.get(session.zoneId) ?? []
              return (
                <DataCard key={session.id} padded>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <StatusBadge status={session.status} />
                        {session.zoneName}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        {session.scheduledDate} · <Dog size={12} aria-hidden="true" /> {session.dogCount}
                      </p>
                    </div>
                    {eligible.length === 0 ? (
                      <p className="text-xs text-muted">Ningún paseador activo cubre esta zona.</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={pickedWalker[session.id] ?? ''}
                          onChange={(event) => setPickedWalker({ ...pickedWalker, [session.id]: event.target.value })}
                          className="input-field min-h-9 text-xs"
                          aria-label={`Paseador para el paseo del ${session.scheduledDate}`}
                        >
                          <option value="">Elegir paseador…</option>
                          {eligible.map((walker) => (
                            <option key={walker.id} value={walker.id}>{walker.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleAssign(session.id)}
                          disabled={!pickedWalker[session.id] || assigning === session.id}
                          className="min-h-9 rounded-full bg-primary px-3 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {assigning === session.id ? 'Asignando…' : 'Asignar'}
                        </button>
                      </div>
                    )}
                  </div>
                </DataCard>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">En curso y recientes</h2>
        {rest.length === 0 ? (
          <p className="text-sm text-muted">Sin más paseos de tu zona por ahora.</p>
        ) : (
          <div className="space-y-2">
            {rest.map((session) => (
              <DataCard key={session.id} padded>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <StatusBadge status={session.status} />
                      {session.zoneName}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{session.scheduledDate}</span>
                      <span className="flex items-center gap-1"><User size={11} aria-hidden="true" />{session.walkerName ?? 'Sin paseador'}</span>
                      <span className="flex items-center gap-1"><Dog size={11} aria-hidden="true" />{session.dogCount}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-2xs text-muted">
                    <span className={`flex items-center gap-1 ${session.reportStatus === 'submitted' ? 'text-success-700' : ''}`}>
                      <FileText size={12} aria-hidden="true" />
                      {session.reportStatus === 'submitted' ? 'Reporte enviado' : session.reportStatus === 'draft' ? 'Reporte en borrador' : 'Sin reporte'}
                    </span>
                    <span className={`flex items-center gap-1 ${session.hasTicket ? 'text-success-700' : ''}`}>
                      <Ticket size={12} aria-hidden="true" />
                      {session.hasTicket ? 'Con ticket' : 'Sin ticket'}
                    </span>
                  </div>
                </div>
              </DataCard>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function messageForAssignError(code: string): string {
  if (code === 'walker-not-active') return 'Ese paseador ya no está activo. Elige otro.'
  if (code === 'not-found' || code === 'conflict') return 'Este paseo ya no existe o cambió de estado. Actualiza la lista.'
  return 'No pudimos asignar el paseo. Intenta de nuevo.'
}
