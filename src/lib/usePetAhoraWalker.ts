'use client'

import { useState, useEffect, useRef } from 'react'
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { usePetAhoraDispatch } from './usePetAhoraDispatch'
import { playOfferChime } from './notificationSound'
import type { PetAhoraOffer, PetAhoraRequest } from '@/types'

export function usePetAhoraWalkerOffers(walkerId: string | undefined) {
  const [offers, setOffers] = useState<(PetAhoraOffer & { request?: PetAhoraRequest })[]>([])
  const [loading, setLoading] = useState(true)
  const prevCount = useRef(0)
  const { acceptOffer, declineOffer } = usePetAhoraDispatch()

  useEffect(() => {
    if (!walkerId) { setLoading(false); return }

    const q = query(
      collection(db, 'petAhoraOffers'),
      where('walkerId', '==', walkerId),
      where('status', '==', 'pending'),
    )

    const unsub = onSnapshot(q, async (snap) => {
      const now = Date.now()
      const pendingOffers: (PetAhoraOffer & { request?: PetAhoraRequest })[] = []
      for (const d of snap.docs) {
        const data = { id: d.id, ...d.data() } as PetAhoraOffer
        if (data.expiresAt?.seconds ? data.expiresAt.seconds * 1000 <= now : false) continue
        try {
          const reqSnap = await getDoc(doc(db, 'petAhoraRequests', data.requestId))
          if (reqSnap.exists()) {
            ;(data as any).request = { id: reqSnap.id, ...reqSnap.data() } as PetAhoraRequest
          }
        } catch {}
        pendingOffers.push(data)
      }

      if (pendingOffers.length > prevCount.current) playOfferChime()
      prevCount.current = pendingOffers.length

      setOffers(pendingOffers)
      setLoading(false)
    }, () => setLoading(false))

    return () => unsub()
  }, [walkerId])

  return { offers, loading }
}

export function usePetAhoraClientRequest(requestId: string | null) {
  const [request, setRequest] = useState<PetAhoraRequest | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!requestId) return
    setLoading(true)

    const unsub = onSnapshot(
      doc(db, 'petAhoraRequests', requestId),
      (snap) => {
        if (snap.exists()) setRequest({ id: snap.id, ...snap.data() } as PetAhoraRequest)
        setLoading(false)
      },
      () => setLoading(false)
    )

    return unsub
  }, [requestId])

  return { request, loading }
}
