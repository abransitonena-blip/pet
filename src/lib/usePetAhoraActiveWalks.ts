'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { PetAhoraRequest } from '@/types'

export function usePetAhoraActiveWalks(walkerId: string | undefined) {
  const [walks, setWalks] = useState<PetAhoraRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!walkerId) { setLoading(false); return }

    const q = query(
      collection(db, 'petAhoraRequests'),
      where('walkerId', '==', walkerId),
    )

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PetAhoraRequest))
        .filter((r) => ['accepted', 'en_camino', 'paseando'].includes(r.status))
      list.sort((a, b) => {
        const ta = a.acceptedAt?.seconds ?? 0
        const tb = b.acceptedAt?.seconds ?? 0
        return ta - tb
      })
      setWalks(list)
      setLoading(false)
    }, () => setLoading(false))

    return () => unsub()
  }, [walkerId])

  return { walks, loading }
}

export async function updatePetAhoraWalkStatus(
  requestId: string,
  status: string,
  extra?: Record<string, any>,
): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'petAhoraRequests', requestId), { status, ...extra })
    return true
  } catch {
    return false
  }
}
