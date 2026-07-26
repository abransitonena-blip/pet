'use client'

import { useState, useEffect } from 'react'
import { collection, query, getDocs, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '@/firebase/config'

interface PublicStats {
  avgRating: number
  totalReviews: number
  totalWalks: number
  happyDogs: number
}

export function usePublicStats(): PublicStats & { loading: boolean } {
  const [stats, setStats] = useState<PublicStats>({ avgRating: 0, totalReviews: 0, totalWalks: 0, happyDogs: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return

      try {
        // Reviews are public (allow read: if true)
        const reviewsSnap = await getDocs(query(collection(db, 'reviews'))).catch(() => null)
        if (cancelled) return

        const reviews = reviewsSnap?.docs.map((d) => d.data()) || []
        const totalReviews = reviews.length
        const avgRating = totalReviews > 0
          ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews) * 10) / 10
          : 0

        let totalWalks = 0
        let happyDogs = 0

        // Reservations require auth — only query when logged in
        if (user) {
          const walksSnap = await getDocs(
            query(collection(db, 'reservations'), where('status', '==', 'completed'))
          ).catch(() => null)
          if (cancelled) return

          totalWalks = walksSnap?.size || 0
          const uniqueDogs = new Set(walksSnap?.docs.map((d) => d.data().petName).filter(Boolean))
          happyDogs = uniqueDogs.size || totalWalks
        }

        setStats({ avgRating, totalReviews, totalWalks, happyDogs })
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => { cancelled = true; unsub() }
  }, [])

  return { ...stats, loading }
}
