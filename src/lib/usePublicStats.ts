'use client'

import { useState, useEffect } from 'react'
import { collection, query, getDocs, where } from 'firebase/firestore'
import { db } from '@/firebase/config'

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
    async function fetch() {
      try {
        const [reviewsSnap, walksSnap] = await Promise.all([
          getDocs(query(collection(db, 'reviews'))),
          getDocs(query(collection(db, 'reservations'), where('status', '==', 'completed'))),
        ])

        const reviews = reviewsSnap.docs.map((d) => d.data())
        const totalReviews = reviews.length
        const avgRating = totalReviews > 0
          ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews) * 10) / 10
          : 0

        const totalWalks = walksSnap.size
        const uniqueDogs = new Set(walksSnap.docs.map((d) => d.data().petName).filter(Boolean))
        const happyDogs = uniqueDogs.size || totalWalks

        setStats({ avgRating, totalReviews, totalWalks, happyDogs })
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return { ...stats, loading }
}
