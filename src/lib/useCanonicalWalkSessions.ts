'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type FirestoreError,
} from 'firebase/firestore'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import type { WalkSessionStatus } from '@/lib/domainStates'
import { WALK_WINDOW_CAP } from '@/lib/recentWindow'
import type { WalkPoint } from '@/types'

export type CanonicalReadError = 'permission-denied' | 'network-error' | 'unavailable'

export interface CanonicalWalkSession {
  id: string
  orderId: string
  customerId: string
  dogIds: string[]
  addressId: string
  serviceId: string
  scheduledDate: string
  scheduledStart: string
  arrivalWindowStart?: string
  arrivalWindowEnd?: string
  status: WalkSessionStatus
  walkerId?: string
  // Solo los dos extremos del paseo; no hay recorrido intermedio.
  startLocation?: WalkPoint
  endLocation?: WalkPoint
  /** Epoch ms of each step the session went through, when it was recorded. */
  transitions?: Partial<Record<SessionStep, number>>
}

/**
 * Which session field records each step. These are the exact fields the
 * Firestore rules require on each transition, so a step with a timestamp is a
 * step that really happened.
 */
const STEP_FIELDS = {
  requested: 'createdAt',
  assigned: 'assignedAt',
  confirmed: 'confirmedAt',
  on_the_way: 'onTheWayAt',
  arrived: 'arrivedAt',
  in_progress: 'startedAt',
  completed: 'completedAt',
} as const

export type SessionStep = keyof typeof STEP_FIELDS

function millis(value: unknown): number | undefined {
  return value && typeof value === 'object' && typeof (value as { seconds?: unknown }).seconds === 'number'
    ? (value as { seconds: number }).seconds * 1000
    : undefined
}

function transitionsFrom(data: Record<string, unknown>): Partial<Record<SessionStep, number>> {
  const result: Partial<Record<SessionStep, number>> = {}
  for (const [step, field] of Object.entries(STEP_FIELDS) as [SessionStep, string][]) {
    const at = millis(data[field])
    if (at !== undefined) result[step] = at
  }
  return result
}

export interface ActiveWalkerOption {
  uid: string
  name: string
  status: 'active'
  /** Zonas que cubre y tope diario declarado: con eso se sugiere a quién asignar. */
  zones: string[]
  maxDaily: number | null
}

export class CanonicalOperationError extends Error {
  constructor(public readonly code: 'auth-required' | 'conflict' | 'walker-not-active' | 'not-found') {
    super(code)
    this.name = 'CanonicalOperationError'
  }
}

export function classifyCanonicalReadError(error: unknown): CanonicalReadError {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
  if (code.includes('permission-denied')) return 'permission-denied'
  if (code.includes('unavailable')) return 'unavailable'
  return 'network-error'
}

export function canonicalReadErrorMessage(error: CanonicalReadError): string {
  if (error === 'permission-denied') return 'Tu sesión no tiene permiso para consultar estas solicitudes.'
  if (error === 'unavailable') return 'Las solicitudes no están disponibles temporalmente.'
  return 'No pudimos consultar las solicitudes. Revisa tu conexión e inténtalo nuevamente.'
}

function walkPoint(value: unknown): WalkPoint | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = value as Record<string, unknown>
  if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return undefined
  return { lat: data.lat, lng: data.lng, accuracy: typeof data.accuracy === 'number' ? data.accuracy : 0 }
}

function sessionFromSnapshot(id: string, data: Record<string, unknown>): CanonicalWalkSession {
  return {
    id,
    orderId: String(data.orderId ?? ''),
    customerId: String(data.customerId ?? ''),
    dogIds: Array.isArray(data.dogIds) ? data.dogIds.filter((value): value is string => typeof value === 'string') : [],
    addressId: String(data.addressId ?? ''),
    serviceId: String(data.serviceId ?? ''),
    scheduledDate: String(data.scheduledDate ?? ''),
    scheduledStart: String(data.scheduledStart ?? ''),
    arrivalWindowStart: typeof data.arrivalWindowStart === 'string' ? data.arrivalWindowStart : undefined,
    arrivalWindowEnd: typeof data.arrivalWindowEnd === 'string' ? data.arrivalWindowEnd : undefined,
    status: String(data.status ?? 'requested') as WalkSessionStatus,
    walkerId: typeof data.walkerId === 'string' ? data.walkerId : undefined,
    startLocation: walkPoint(data.startLocation),
    endLocation: walkPoint(data.endLocation),
    ...withTransitions(transitionsFrom(data)),
  }
}

// Only present when there is something to say, so sessions without any
// recorded step keep the exact shape they had before.
function withTransitions(transitions: Partial<Record<SessionStep, number>>) {
  return Object.keys(transitions).length > 0 ? { transitions } : {}
}

/**
 * Los paseos de una familia dentro de una ventana de fechas.
 *
 * Sin ventana son los 100 MÁS ANTIGUOS (orden ascendente con tope), así que una
 * familia con paseo diario dejaba de ver lo suyo a los tres meses. Cada pantalla
 * pide el rango que necesita; ver recentWindow.ts.
 */
export function useCustomerWalkSessions(customerId: string, options: { since?: string; until?: string } = {}) {
  const [sessions, setSessions] = useState<CanonicalWalkSession[]>([])
  const [loading, setLoading] = useState(Boolean(customerId))
  const [error, setError] = useState<CanonicalReadError | null>(null)
  const [capped, setCapped] = useState(false)
  const [revision, setRevision] = useState(0)
  const { since, until } = options

  useEffect(() => {
    if (!customerId) {
      setSessions([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const sessionsQuery = query(
      collection(db, 'walkSessions'),
      where('customerId', '==', customerId),
      ...(since ? [where('scheduledDate', '>=', since)] : []),
      ...(until ? [where('scheduledDate', '<=', until)] : []),
      orderBy('scheduledDate', 'asc'),
      limit(WALK_WINDOW_CAP),
    )
    return onSnapshot(sessionsQuery, (snapshot) => {
      setSessions(snapshot.docs.map((item) => sessionFromSnapshot(item.id, item.data())))
      setCapped(snapshot.docs.length === WALK_WINDOW_CAP)
      setError(null)
      setLoading(false)
    }, (readError: FirestoreError) => {
      setSessions([])
      setError(classifyCanonicalReadError(readError))
      setLoading(false)
    })
  }, [customerId, since, until, revision])

  return { sessions, loading, error, capped, retry: () => setRevision((value) => value + 1) }
}

export function useRequestedWalkSessions() {
  const [sessions, setSessions] = useState<CanonicalWalkSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<CanonicalReadError | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    setLoading(true)
    const sessionsQuery = query(
      collection(db, 'walkSessions'),
      where('status', '==', 'requested'),
      orderBy('createdAt', 'asc'),
      limit(100),
    )
    return onSnapshot(sessionsQuery, (snapshot) => {
      setSessions(snapshot.docs.map((item) => sessionFromSnapshot(item.id, item.data())))
      setError(null)
      setLoading(false)
    }, (readError: FirestoreError) => {
      setSessions([])
      setError(classifyCanonicalReadError(readError))
      setLoading(false)
    })
  }, [revision])

  return { sessions, loading, error, retry: () => setRevision((value) => value + 1) }
}

/**
 * Los paseos ya agendados de los próximos días, para saber cómo va la carga de
 * cada paseador antes de asignarle otro. Lee una sola ventana con tope; si la
 * llena, quien la use debe decirlo en vez de dar por buena la cuenta.
 */
export function useUpcomingAssignments(days = 14) {
  const [assignments, setAssignments] = useState<{ walkerId: string; scheduledDate: string; dogIds: string[] }[]>([])
  const [capped, setCapped] = useState(false)

  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA')
    const [year, month, day] = today.split('-').map(Number)
    const until = new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
    const upcoming = query(
      collection(db, 'walkSessions'),
      where('scheduledDate', '>=', today),
      where('scheduledDate', '<=', until),
      orderBy('scheduledDate', 'asc'),
      limit(100),
    )
    return onSnapshot(upcoming, (snapshot) => {
      setCapped(snapshot.docs.length === 100)
      setAssignments(snapshot.docs.flatMap((item) => {
        const data = item.data()
        const walkerId = typeof data.walkerId === 'string' ? data.walkerId : ''
        if (!walkerId) return []
        return [{
          walkerId,
          scheduledDate: typeof data.scheduledDate === 'string' ? data.scheduledDate : '',
          dogIds: Array.isArray(data.dogIds) ? data.dogIds.filter((dogId: unknown): dogId is string => typeof dogId === 'string') : [],
        }]
      }))
    }, () => {
      setAssignments([])
      setCapped(false)
    })
  }, [days])

  return { assignments, capped }
}

export function useActiveWalkerOptions() {
  const [walkers, setWalkers] = useState<ActiveWalkerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<CanonicalReadError | null>(null)

  useEffect(() => {
    const walkersQuery = query(
      collection(db, 'walkerProfiles'),
      where('status', '==', 'active'),
      limit(100),
    )
    return onSnapshot(walkersQuery, (snapshot) => {
      setWalkers(snapshot.docs.map((item) => {
        const data = item.data()
        return {
          uid: item.id,
          name: typeof data.name === 'string' && data.name.trim() ? data.name : `Paseador ${item.id.slice(0, 6)}`,
          status: 'active' as const,
          zones: Array.isArray(data.zones) ? data.zones.filter((zone: unknown): zone is string => typeof zone === 'string') : [],
          maxDaily: typeof data.maxDaily === 'number' ? data.maxDaily : null,
        }
      }))
      setError(null)
      setLoading(false)
    }, (readError: FirestoreError) => {
      setWalkers([])
      setError(classifyCanonicalReadError(readError))
      setLoading(false)
    })
  }, [])

  return { walkers, loading, error }
}

export function useCanonicalAddressZones(addressIds: string[]) {
  const [zonesByAddress, setZonesByAddress] = useState<Record<string, string>>({})
  const [error, setError] = useState<CanonicalReadError | null>(null)
  const signature = Array.from(new Set(addressIds.filter(Boolean))).sort().join('|')

  useEffect(() => {
    const ids = signature ? signature.split('|') : []
    if (ids.length === 0) {
      setZonesByAddress({})
      setError(null)
      return
    }
    let active = true
    ;(async () => {
      try {
        const chunks: string[][] = []
        for (let index = 0; index < ids.length; index += 10) chunks.push(ids.slice(index, index + 10))
        const [addressSnapshots, zoneSnapshot] = await Promise.all([
          Promise.all(chunks.map((chunk) => getDocs(query(
            collection(db, 'addresses'),
            where(documentId(), 'in', chunk),
            limit(25),
          )))),
          getDocs(query(collection(db, 'zones'), limit(100))),
        ])
        if (!active) return
        const zoneNames = new Map(zoneSnapshot.docs.map((item) => [item.id, String(item.data().name || item.id)]))
        const next: Record<string, string> = {}
        for (const snapshot of addressSnapshots) {
          for (const item of snapshot.docs) {
            const zoneId = String(item.data().zoneId || '')
            next[item.id] = zoneId ? (zoneNames.get(zoneId) || zoneId) : 'Zona no definida'
          }
        }
        setZonesByAddress(next)
        setError(null)
      } catch (cause) {
        if (active) setError(classifyCanonicalReadError(cause))
      }
    })()
    return () => { active = false }
  }, [signature])

  return { zonesByAddress, error }
}

export async function assignCanonicalWalkSession(sessionId: string, walkerId: string): Promise<void> {
  const actorUid = auth.currentUser?.uid
  if (!actorUid) throw new CanonicalOperationError('auth-required')
  await runTransaction(db, async (transaction) => {
    const sessionRef = doc(db, 'walkSessions', sessionId)
    const walkerRef = doc(db, 'walkerProfiles', walkerId)
    const [sessionSnapshot, walkerSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(walkerRef),
    ])
    if (!sessionSnapshot.exists()) throw new CanonicalOperationError('not-found')
    if (!walkerSnapshot.exists() || walkerSnapshot.data().status !== 'active') {
      throw new CanonicalOperationError('walker-not-active')
    }
    const session = sessionSnapshot.data()
    if (session.status !== 'requested' || session.walkerId) {
      throw new CanonicalOperationError('conflict')
    }
    transaction.update(sessionRef, {
      status: 'assigned',
      walkerId,
      assignedBy: actorUid,
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function reprogramCanonicalWalkSession(
  sessionId: string,
  schedule: { scheduledDate: string; scheduledStart: string; arrivalWindowStart?: string; arrivalWindowEnd?: string },
): Promise<void> {
  if (!auth.currentUser?.uid) throw new CanonicalOperationError('auth-required')
  await runTransaction(db, async (transaction) => {
    const sessionRef = doc(db, 'walkSessions', sessionId)
    const snapshot = await transaction.get(sessionRef)
    if (!snapshot.exists()) throw new CanonicalOperationError('not-found')
    if (!['requested', 'assigned'].includes(String(snapshot.data().status))) {
      throw new CanonicalOperationError('conflict')
    }
    transaction.update(sessionRef, {
      scheduledDate: schedule.scheduledDate,
      scheduledStart: schedule.scheduledStart,
      arrivalWindowStart: schedule.arrivalWindowStart ?? schedule.scheduledStart,
      arrivalWindowEnd: schedule.arrivalWindowEnd ?? '',
      updatedAt: serverTimestamp(),
    })
  })
}
