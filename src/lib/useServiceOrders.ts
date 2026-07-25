'use client'

import { useState, useEffect } from 'react'
import { db } from '@/firebase/config'
import {
  collection, query, orderBy, onSnapshot, where, limit as fsLimit, getDocs,
} from 'firebase/firestore'
import type { ServiceOrder, WalkSession } from '@/types'

export interface ServiceOrderWithSessions extends ServiceOrder {
  sessions: WalkSession[]
}

export function useServiceOrders(opts?: { clientId?: string; status?: string; pageSize?: number }) {
  const [orders, setOrders] = useState<ServiceOrderWithSessions[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const constraints: any[] = [orderBy('createdAt', 'desc')]
    if (opts?.clientId) constraints.push(where('clientId', '==', opts.clientId))
    if (opts?.status) constraints.push(where('status', '==', opts.status))
    if (opts?.pageSize) constraints.push(fsLimit(opts.pageSize))

    const q = query(collection(db, 'serviceOrders'), ...constraints)

    const unsub = onSnapshot(q, async (snap) => {
      const orderList: ServiceOrderWithSessions[] = []
      for (const orderDoc of snap.docs) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as ServiceOrder

        // Fetch sessions subcollection
        const sessionsQ = query(
          collection(db, 'serviceOrders', orderDoc.id, 'sessions'),
          orderBy('date', 'asc'),
        )
        const sessionsSnap = await getDocs(sessionsQ).catch(() => null)
        const sessions = sessionsSnap
          ? sessionsSnap.docs.map((s) => ({ id: s.id, ...s.data() } as WalkSession))
          : []

        orderList.push({ ...orderData, sessions })
      }
      setOrders(orderList)
      setLoading(false)
    }, () => setLoading(false))

    return unsub
  }, [opts?.clientId, opts?.status, opts?.pageSize])

  return { orders, loading }
}

export function useWalkerSessions(walkerId: string, walkerName: string) {
  const [sessions, setSessions] = useState<(WalkSession & { orderId: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!walkerId && !walkerName) { setLoading(false); return }

    // Fetch all active orders, then filter sessions by walker
    const q = query(collection(db, 'serviceOrders'), where('status', '==', 'active'))
    const unsub = onSnapshot(q, async (snap) => {
      const matched: (WalkSession & { orderId: string })[] = []
      for (const orderDoc of snap.docs) {
        const sessionsQ = query(
          collection(db, 'serviceOrders', orderDoc.id, 'sessions'),
          where('assignmentStatus', 'in', ['assigned', 'confirmed']),
        )
        const sessionsSnap = await getDocs(sessionsQ).catch(() => null)
        if (sessionsSnap) {
          for (const s of sessionsSnap.docs) {
            const data = s.data()
            if (data.walkerId === walkerId || data.walkerName === walkerName) {
              matched.push({ id: s.id, orderId: orderDoc.id, ...data } as WalkSession & { orderId: string })
            }
          }
        }
      }
      setSessions(matched.sort((a, b) => (a.date > b.date ? 1 : -1)))
      setLoading(false)
    }, () => setLoading(false))

    return unsub
  }, [walkerId, walkerName])

  return { sessions, loading }
}
