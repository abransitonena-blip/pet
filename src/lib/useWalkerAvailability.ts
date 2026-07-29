'use client'

import { useState, useEffect } from 'react'
import { db } from '@/firebase/config'
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import type { Walker } from '@/types'

export interface WalkerAvailabilityResult {
  loading: boolean
  available: Walker[]
  totalWalkers: number
}

export function useWalkerAvailability(zoneId?: string, date?: string): WalkerAvailabilityResult {
  const [result, setResult] = useState<WalkerAvailabilityResult>({
    loading: true, available: [], totalWalkers: 0,
  })

  useEffect(() => {
    let cancelled = false

    const constraints = [where('status', '==', 'active')]
    if (zoneId) constraints.push(where('zones', 'array-contains', zoneId))

    const q = query(collection(db, 'walkers'), ...constraints)

    const unsub = onSnapshot(q, (snap) => {
      if (cancelled) return
      const walkers = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Walker))

      let available = walkers

      if (date) {
        const dayMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
        const dayOfWeek = dayMap[new Date(date + 'T12:00:00').getDay()]

        available = walkers.filter((w) => {
          if (!w.schedule?.[dayOfWeek]?.length) return false
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
