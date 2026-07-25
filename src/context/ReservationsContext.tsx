'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { db } from '@/firebase/config'
import { collection, query, orderBy, onSnapshot, limit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore'
import type { Reservation } from '@/types'

interface ReservationsContextType {
  reservations: Reservation[]
  loading: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
}

const PAGE_SIZE = 100

const ReservationsContext = createContext<ReservationsContextType>({
  reservations: [],
  loading: true,
  hasMore: false,
  loadMore: async () => {},
})

export function ReservationsProvider({ children }: { children: ReactNode }) {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation))
      setReservations(docs)
      setLastDoc(snap.docs[snap.docs.length - 1] || null)
      setHasMore(snap.docs.length === PAGE_SIZE)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const loadMore = useCallback(async () => {
    if (!hasMore || !lastDoc) return
    try {
      const q = query(
        collection(db, 'reservations'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      )
      const snap = await getDocs(q)
      const newDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation))
      setReservations((prev) => [...prev, ...newDocs])
      setLastDoc(snap.docs[snap.docs.length - 1] || null)
      setHasMore(snap.docs.length === PAGE_SIZE)
    } catch {
      // silently fail
    }
  }, [hasMore, lastDoc])

  return (
    <ReservationsContext.Provider value={{ reservations, loading, hasMore, loadMore }}>
      {children}
    </ReservationsContext.Provider>
  )
}

export const useReservations = () => useContext(ReservationsContext)
