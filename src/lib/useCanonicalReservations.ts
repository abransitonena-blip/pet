'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  documentId,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type FirestoreError,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { WalkSessionStatus } from '@/lib/domainStates'
import { classifyCanonicalReadError, type CanonicalReadError } from '@/lib/useCanonicalWalkSessions'
import { getReservationServiceDefinitions } from '@/lib/walkServices'

/**
 * Adapter over the canonical `walkSessions` collection, shaped like the legacy
 * `reservations` documents the panels were written against.
 *
 * Why this exists: bookings have been written to `serviceOrders`/`walkSessions`
 * since the migration (LEGACY_RESERVATION_WRITES_ENABLED is false), but several
 * panels still read `reservations` — a collection nothing writes to anymore, so
 * they never show a new booking. This lets those panels move to the canonical
 * source without rewriting their rendering.
 *
 * Names/phones live on other documents (customerProfiles, dogs, walkerProfiles),
 * so they are resolved here in batched `in` queries rather than one read per row.
 */

/**
 * The rules only allow listing walkSessions with `limit <= 100`
 * (`validListLimit(100)` in firestore.rules). A bigger limit does not return a
 * shorter list: Firestore rejects the whole query as permission-denied, which
 * is how Finanzas, Analítica, Insights, Familias and Perros broke when they
 * asked for 500 at once. More history is read in pages of this size.
 */
export const WALK_SESSIONS_PAGE_SIZE = 100

export interface CanonicalReservationView {
  id: string
  orderId: string
  customerId: string
  name: string
  phone: string
  dogIds: string[]
  petName: string
  serviceId: string
  service: string
  /** Versión de la tarifa con la que se reservó; ver businessMetrics.ts. */
  serviceVersion: number | null
  date: string
  time: string
  arrivalWindowStart?: string
  arrivalWindowEnd?: string
  status: WalkSessionStatus
  assignedWalker: string
  walkerName: string
  addressId: string
  notes: string
  createdAt: { seconds: number; nanoseconds: number } | null
}

interface RawSession {
  id: string
  orderId: string
  customerId: string
  dogIds: string[]
  addressId: string
  serviceId: string
  serviceVersion: number | null
  scheduledDate: string
  scheduledStart: string
  arrivalWindowStart?: string
  arrivalWindowEnd?: string
  status: WalkSessionStatus
  walkerId: string
  notes: string
  createdAt: { seconds: number; nanoseconds: number } | null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function timestamp(value: unknown): { seconds: number; nanoseconds: number } | null {
  if (value && typeof value === 'object' && 'seconds' in value && typeof (value as { seconds: unknown }).seconds === 'number') {
    return value as { seconds: number; nanoseconds: number }
  }
  return null
}

function rawFromSnapshot(id: string, data: Record<string, unknown>): RawSession {
  return {
    id,
    orderId: text(data.orderId),
    customerId: text(data.customerId),
    dogIds: Array.isArray(data.dogIds) ? data.dogIds.filter((value): value is string => typeof value === 'string') : [],
    addressId: text(data.addressId),
    serviceId: text(data.serviceId),
    serviceVersion: typeof data.serviceVersion === 'number' ? data.serviceVersion : null,
    scheduledDate: text(data.scheduledDate),
    scheduledStart: text(data.scheduledStart),
    arrivalWindowStart: text(data.arrivalWindowStart) || undefined,
    arrivalWindowEnd: text(data.arrivalWindowEnd) || undefined,
    status: (text(data.status) || 'requested') as WalkSessionStatus,
    walkerId: text(data.walkerId),
    notes: text(data.notes),
    createdAt: timestamp(data.createdAt),
  }
}

/** Firestore caps `in` filters at 10 values, so ids are read in chunks. */
async function readNamesById(
  collectionName: string,
  ids: string[],
  pick: (data: Record<string, unknown>) => { name: string; phone?: string },
): Promise<Record<string, { name: string; phone: string }>> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return {}
  const chunks: string[][] = []
  for (let index = 0; index < unique.length; index += 10) chunks.push(unique.slice(index, index + 10))
  const snapshots = await Promise.all(chunks.map((chunk) => getDocs(query(
    collection(db, collectionName),
    where(documentId(), 'in', chunk),
    fsLimit(10),
  ))))
  const resolved: Record<string, { name: string; phone: string }> = {}
  for (const snapshot of snapshots) {
    for (const item of snapshot.docs) {
      const picked = pick(item.data())
      resolved[item.id] = { name: picked.name, phone: picked.phone ?? '' }
    }
  }
  return resolved
}

export interface CanonicalReservationsOptions {
  /** Restrict to one customer (Familia panels). Omit for staff-wide reads. */
  customerId?: string
  /** Inclusive `scheduledDate` lower bound, `YYYY-MM-DD`. */
  fromDate?: string
  /** Inclusive `scheduledDate` upper bound, `YYYY-MM-DD`. */
  toDate?: string
  max?: number
}

export function useCanonicalReservations(options: CanonicalReservationsOptions = {}) {
  const { customerId, fromDate, toDate, max = 200 } = options
  const [sessions, setSessions] = useState<RawSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<CanonicalReadError | null>(null)
  const [revision, setRevision] = useState(0)
  const [customers, setCustomers] = useState<Record<string, { name: string; phone: string }>>({})
  const [dogs, setDogs] = useState<Record<string, { name: string; phone: string }>>({})
  const [walkers, setWalkers] = useState<Record<string, { name: string; phone: string }>>({})

  useEffect(() => {
    setLoading(true)
    const filters: QueryConstraint[] = []
    if (customerId) filters.push(where('customerId', '==', customerId))
    if (fromDate) filters.push(where('scheduledDate', '>=', fromDate))
    if (toDate) filters.push(where('scheduledDate', '<=', toDate))

    const pageQuery = (size: number, after?: QueryDocumentSnapshot) => query(
      collection(db, 'walkSessions'),
      ...filters,
      orderBy('scheduledDate', 'desc'),
      ...(after ? [startAfter(after)] : []),
      fsLimit(size),
    )

    const firstPageSize = Math.min(max, WALK_SESSIONS_PAGE_SIZE)
    let cancelled = false
    let newest: RawSession[] = []
    let older: RawSession[] = []
    let olderCursorId = ''
    let olderRequest = 0

    const publish = () => {
      const seen = new Set<string>()
      const merged: RawSession[] = []
      for (const session of [...newest, ...older]) {
        if (seen.has(session.id)) continue
        seen.add(session.id)
        merged.push(session)
      }
      setSessions(merged.slice(0, max))
      setError(null)
      setLoading(false)
    }

    const fail = (readError: unknown) => {
      if (cancelled) return
      setSessions([])
      setError(classifyCanonicalReadError(readError as FirestoreError))
      setLoading(false)
    }

    const loadOlder = async (cursor: QueryDocumentSnapshot): Promise<RawSession[]> => {
      const pages: RawSession[] = []
      let after = cursor
      while (newest.length + pages.length < max) {
        const size = Math.min(WALK_SESSIONS_PAGE_SIZE, max - newest.length - pages.length)
        const snapshot = await getDocs(pageQuery(size, after))
        pages.push(...snapshot.docs.map((item) => rawFromSnapshot(item.id, item.data())))
        if (snapshot.docs.length < size) break
        after = snapshot.docs[snapshot.docs.length - 1]
      }
      return pages
    }

    // The newest page stays live -- today's walks change status while staff
    // watch. Older history is read once, and again only when that page's
    // last walk changes.
    const unsubscribe = onSnapshot(pageQuery(firstPageSize), (snapshot) => {
      if (cancelled) return
      newest = snapshot.docs.map((item) => rawFromSnapshot(item.id, item.data()))
      const last = snapshot.docs[snapshot.docs.length - 1]
      if (max <= firstPageSize || snapshot.docs.length < firstPageSize || !last) {
        older = []
        publish()
        return
      }
      if (last.id === olderCursorId) {
        publish()
        return
      }
      const firstLoad = olderCursorId === ''
      olderCursorId = last.id
      // After the first load, show the live page right away; history follows.
      if (!firstLoad) publish()
      const request = ++olderRequest
      loadOlder(last)
        .then((pages) => {
          if (cancelled || request !== olderRequest) return
          older = pages
          publish()
        })
        .catch((readError) => {
          if (request === olderRequest) fail(readError)
        })
    }, fail)

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [customerId, fromDate, toDate, max, revision])

  const customerIds = useMemo(
    () => Array.from(new Set(sessions.map((item) => item.customerId).filter(Boolean))).sort().join('|'),
    [sessions],
  )
  const dogIds = useMemo(
    () => Array.from(new Set(sessions.flatMap((item) => item.dogIds))).sort().join('|'),
    [sessions],
  )
  const walkerIds = useMemo(
    () => Array.from(new Set(sessions.map((item) => item.walkerId).filter(Boolean))).sort().join('|'),
    [sessions],
  )

  useEffect(() => {
    let active = true
    const ids = customerIds ? customerIds.split('|') : []
    readNamesById('customerProfiles', ids, (data) => ({
      name: text(data.name) || text(data.displayName),
      phone: text(data.phone),
    }))
      .then((resolved) => { if (active) setCustomers(resolved) })
      .catch(() => { if (active) setCustomers({}) })
    return () => { active = false }
  }, [customerIds])

  useEffect(() => {
    let active = true
    const ids = dogIds ? dogIds.split('|') : []
    readNamesById('dogs', ids, (data) => ({ name: text(data.name) }))
      .then((resolved) => { if (active) setDogs(resolved) })
      .catch(() => { if (active) setDogs({}) })
    return () => { active = false }
  }, [dogIds])

  useEffect(() => {
    let active = true
    const ids = walkerIds ? walkerIds.split('|') : []
    readNamesById('walkerProfiles', ids, (data) => ({ name: text(data.name) }))
      .then((resolved) => { if (active) setWalkers(resolved) })
      .catch(() => { if (active) setWalkers({}) })
    return () => { active = false }
  }, [walkerIds])

  const reservations = useMemo<CanonicalReservationView[]>(() => {
    const serviceNames = new Map(getReservationServiceDefinitions().map((item) => [item.id, item.name]))
    return sessions.map((session) => ({
      id: session.id,
      orderId: session.orderId,
      customerId: session.customerId,
      name: customers[session.customerId]?.name || '',
      phone: customers[session.customerId]?.phone || '',
      dogIds: session.dogIds,
      petName: session.dogIds.map((dogId) => dogs[dogId]?.name).filter(Boolean).join(', '),
      serviceId: session.serviceId,
      service: serviceNames.get(session.serviceId) || session.serviceId,
      serviceVersion: session.serviceVersion,
      date: session.scheduledDate,
      time: session.scheduledStart,
      arrivalWindowStart: session.arrivalWindowStart,
      arrivalWindowEnd: session.arrivalWindowEnd,
      status: session.status,
      assignedWalker: session.walkerId,
      walkerName: walkers[session.walkerId]?.name || '',
      addressId: session.addressId,
      notes: session.notes,
      createdAt: session.createdAt,
    }))
  }, [sessions, customers, dogs, walkers])

  return {
    reservations,
    loading,
    error,
    retry: () => setRevision((value) => value + 1),
  }
}
