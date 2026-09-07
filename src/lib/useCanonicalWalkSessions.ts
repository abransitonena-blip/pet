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
import { auth, db } from '@/firebase/config'
import type { WalkSessionStatus } from '@/lib/domainStates'

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
}

export interface ActiveWalkerOption {
  uid: string
  name: string
  status: 'active'
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
  }
}

export function useCustomerWalkSessions(customerId: string) {
  const [sessions, setSessions] = useState<CanonicalWalkSession[]>([])
  const [loading, setLoading] = useState(Boolean(customerId))
  const [error, setError] = useState<CanonicalReadError | null>(null)
  const [revision, setRevision] = useState(0)

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
      orderBy('scheduledDate', 'asc'),
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
  }, [customerId, revision])

  return { sessions, loading, error, retry: () => setRevision((value) => value + 1) }
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
      setWalkers(snapshot.docs.map((item) => ({
        uid: item.id,
        name: typeof item.data().name === 'string' && item.data().name.trim()
          ? item.data().name
          : `Paseador ${item.id.slice(0, 6)}`,
        status: 'active' as const,
      })))
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
