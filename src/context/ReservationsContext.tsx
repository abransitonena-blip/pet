'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { db } from '@/firebase/config'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import type { Reservation } from '@/types'

interface ReservationsContextType {
  reservations: Reservation[]
  loading: boolean
}

const ReservationsContext = createContext<ReservationsContextType>({
  reservations: [],
  loading: true,
})

export function ReservationsProvider({ children }: { children: ReactNode }) {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  return (
    <ReservationsContext.Provider value={{ reservations, loading }}>
      {children}
    </ReservationsContext.Provider>
  )
}

export const useReservations = () => useContext(ReservationsContext)
