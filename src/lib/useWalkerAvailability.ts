'use client'

import { useState, useEffect } from 'react'
import { db } from '@/firebase/db'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import type { Walker } from '@/types'
import { daySlots } from '@/lib/dispatch'

export interface WalkerAvailabilityResult {
  loading: boolean
  available: Walker[]
  totalWalkers: number
}

/**
 * Fuente canónica de paseadores: `walkerProfiles`.
 *
 * These queries used to read a `walkers` collection that nothing in the app
 * has ever written to -- every read came back empty, so dispatch could never
 * find anybody and each request expired by itself. `walkerProfiles` is the
 * document the rules actually check for `status == 'active'` before allowing
 * an assignment, and it is what the admin panel writes.
 */

export function useWalkerAvailability(zoneId?: string, date?: string): WalkerAvailabilityResult {
  const [result, setResult] = useState<WalkerAvailabilityResult>({
    loading: true, available: [], totalWalkers: 0,
  })

  useEffect(() => {
    let cancelled = false

    const constraints = [where('status', '==', 'active')]
    if (zoneId) constraints.push(where('zones', 'array-contains', zoneId))

    const q = query(collection(db, 'walkerProfiles'), ...constraints)

    const unsub = onSnapshot(q, (snap) => {
      if (cancelled) return
      const walkers = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Walker))

      let available = walkers

      if (date) {
        const dayMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
        const dayOfWeek = dayMap[new Date(date + 'T12:00:00').getDay()]

        available = walkers.filter((w) => {
          if (daySlots(w.schedule, dayOfWeek).length === 0) return false
          const load = w.currentLoad?.todayAssigned ?? 0
          const max = w.capacity?.maxDaily ?? 8
          return load < max
        })
      }

      if (!cancelled) {
        setResult({ loading: false, available, totalWalkers: walkers.length })
      }
    }, () => {
      if (!cancelled) setResult({ loading: false, available: [], totalWalkers: 0 })
    })

    return () => { cancelled = true; unsub() }
  }, [zoneId, date])

  return result
}
