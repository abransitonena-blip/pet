'use client'

import { useState, useEffect } from 'react'
import { loadFirestore } from '@/firebase/lazyFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

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

    const load = async () => {
      if (!FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED) {
        setLoading(false)
        return
      }
      try {
        // El SDK llega aparte: esta cifra adorna la portada, no vale que retrase
        // su primera carga. Ver firebase/lazyFirestore.ts.
        const { db, collection, query, getDocs, where, limit } = await loadFirestore()
        const reviewsSnap = await getDocs(query(
          collection(db, 'reviews'),
          where('moderationStatus', '==', 'published'),
          where('verified', '==', true),
          limit(50),
        ))
        if (cancelled) return

        const reviews = reviewsSnap.docs.map((d) => d.data())
        const totalReviews = reviews.length
        const avgRating = totalReviews > 0
          ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews) * 10) / 10
          : 0

        setStats({ avgRating, totalReviews, totalWalks: 0, happyDogs: 0 })
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => { cancelled = true }
  }, [])

  return { ...stats, loading }
}
