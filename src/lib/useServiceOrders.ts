'use client'

import { useState, useEffect } from 'react'
import { db } from '@/firebase/config'
import {
  collection, query, orderBy, onSnapshot, where, limit as fsLimit, getDocs,
  doc, runTransaction, serverTimestamp, type FirestoreError, type QueryConstraint,
} from 'firebase/firestore'
import type { ServiceOrder, WalkSession } from '@/types'
import { classifyWalkerReadError, getWalkerTransition, type WalkerReadError } from '@/lib/walkerPanel'
import { captureWalkPoint, locationFieldForTransition } from '@/lib/walkLocation'
import { notifySessionEvent } from '@/lib/push/pushClient'

export interface ServiceOrderWithSessions extends ServiceOrder {
  sessions: WalkSession[]
}

type ReadError = 'permission-denied' | 'network-error' | null

function classifyReadError(error: FirestoreError): Exclude<ReadError, null> {
  return error.code === 'permission-denied' ? 'permission-denied' : 'network-error'
}

export function useServiceOrders(opts?: { customerId?: string; status?: string; pageSize?: number }) {
  const [orders, setOrders] = useState<ServiceOrderWithSessions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ReadError>(null)

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
    if (opts?.customerId) constraints.push(where('customerId', '==', opts.customerId))
    if (opts?.status) constraints.push(where('status', '==', opts.status))
    constraints.push(fsLimit(Math.min(opts?.pageSize ?? 50, 100)))

    const q = query(collection(db, 'serviceOrders'), ...constraints)

    const unsub = onSnapshot(q, async (snap) => {
      try {
        const sessionByOrder = new Map<string, WalkSession[]>()
        const orderIds = snap.docs.map((orderDoc) => orderDoc.id)
        for (let index = 0; index < orderIds.length; index += 30) {
          const ids = orderIds.slice(index, index + 30)
          if (ids.length === 0) continue
          const sessionConstraints: QueryConstraint[] = [
            where('orderId', 'in', ids),
            orderBy('scheduledDate', 'asc'),
            fsLimit(100),
          ]
          if (opts?.customerId) {
            sessionConstraints.unshift(where('customerId', '==', opts.customerId))
          }
          const sessionsSnap = await getDocs(query(collection(db, 'walkSessions'), ...sessionConstraints))
          for (const sessionDoc of sessionsSnap.docs) {
            const data = sessionDoc.data()
            const session = {
              id: sessionDoc.id,
              ...data,
              date: data.scheduledDate,
              startTime: data.scheduledStart,
              sessionStatus: data.status,
            } as WalkSession
            const current = sessionByOrder.get(data.orderId) ?? []
            current.push(session)
            sessionByOrder.set(data.orderId, current)
          }
        }
        setOrders(snap.docs.map((orderDoc) => ({
          id: orderDoc.id,
          ...orderDoc.data(),
          sessions: sessionByOrder.get(orderDoc.id) ?? [],
        } as ServiceOrderWithSessions)))
        setError(null)
      } catch (readError) {
        setOrders([])
        setError(classifyReadError(readError as FirestoreError))
      } finally {
        setLoading(false)
      }
    }, (readError) => {
      setOrders([])
      setError(classifyReadError(readError))
      setLoading(false)
    })

    return unsub
  }, [opts?.customerId, opts?.status, opts?.pageSize])

  return { orders, loading, error }
}

/**
 * Los paseos de un paseador, en orden de fecha y con tope de 100.
 *
 * El orden ascendente con tope devuelve los 100 MÁS ANTIGUOS: sin `since`, un
 * paseador con más de 100 paseos deja de ver los de hoy. `since` (YYYY-MM-DD)
 * recorta la ventana por abajo y usa el mismo índice (walkerId, scheduledDate).
 */
export function useWalkerSessions(walkerId: string, options: { since?: string } = {}) {
  const [sessions, setSessions] = useState<(WalkSession & { orderId: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<WalkerReadError | null>(null)
  const [revision, setRevision] = useState(0)
  const { since } = options

  useEffect(() => {
    if (!walkerId) {
      setSessions([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(
      collection(db, 'walkSessions'),
      where('walkerId', '==', walkerId),
      ...(since ? [where('scheduledDate', '>=', since)] : []),
      orderBy('scheduledDate', 'asc'),
      fsLimit(100),
    )
    const unsub = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((sessionDoc) => {
        const data = sessionDoc.data()
        return {
          id: sessionDoc.id,
          ...data,
          date: data.scheduledDate,
          startTime: data.scheduledStart,
          sessionStatus: data.status,
        } as WalkSession & { orderId: string }
      }))
      setError(null)
      setLoading(false)
    }, (readError) => {
      setError(classifyWalkerReadError(readError))
      setLoading(false)
    })

    return unsub
  }, [walkerId, since, revision])

  return { sessions, loading, error, retry: () => setRevision((value) => value + 1) }
}

export async function advanceWalkerSession(session: WalkSession): Promise<void> {
  const status = session.status ?? session.sessionStatus
  const transition = getWalkerTransition(status)
  if (!transition) throw new Error('walker-transition-not-allowed')

  // Starting and finishing a walk also record where it happened. The read runs
  // before the transaction because geolocation can take seconds and a
  // Firestore transaction must not be held open waiting on a device sensor.
  // It is best-effort: null means the walk advances without a location rather
  // than not advancing at all (see walkLocation.ts).
  const locationField = locationFieldForTransition(transition.to)
  const point = locationField ? await captureWalkPoint() : null

  const sessionRef = doc(db, 'walkSessions', session.id)
  const commit = (withLocation: boolean) => runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(sessionRef)
    if (!snapshot.exists()) throw new Error('walker-session-not-found')

    const current = snapshot.data()
    if (current.status !== transition.from || current.walkerId !== session.walkerId) {
      throw new Error('walker-transition-conflict')
    }

    const timestamp = serverTimestamp()
    transaction.update(sessionRef, {
      status: transition.to,
      [transition.timestampField]: timestamp,
      ...(withLocation && locationField && point ? { [locationField]: point } : {}),
      updatedAt: timestamp,
    })
  })

  try {
    await commit(true)
  } catch (cause) {
    // Location is best-effort; the transition is not. If the deployed rules
    // predate the location fields -- the app can ship before `firebase deploy
    // --only firestore:rules` runs -- the write carrying a point is rejected
    // as a whole, which would stop every walker from starting or finishing a
    // walk. Retry once without it. Any other failure propagates unchanged.
    const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
    if (!point || !code.includes('permission-denied')) throw cause
    await commit(false)
  }

  // Tell the family. A no-op while FCM_ENABLED is off, and fire-and-forget:
  // the walk has already advanced and a failed push must never undo that.
  notifySessionEvent(session.id)
}
