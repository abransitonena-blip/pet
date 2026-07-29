'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { WalkerPresence } from '@/types'

const STALE_THRESHOLD_SECONDS = 60

interface OnlineWalker extends WalkerPresence {
  minutesSinceHeartbeat: number
}

export function useOnlineWalkers(zoneId?: string): {
  loading: boolean
  onlineWalkers: OnlineWalker[]
  totalOnline: number
} {
  const [result, setResult] = useState<{ loading: boolean; onlineWalkers: OnlineWalker[]; totalOnline: number }>({
    loading: true, onlineWalkers: [], totalOnline: 0,
  })

  useEffect(() => {
    let cancelled = false

    const constraints = [where('status', '==', 'online')]
    const q = query(collection(db, 'walkerPresence'), ...constraints)

    const unsub = onSnapshot(q, (snap) => {
      if (cancelled) return

      const now = Date.now()
      let walkers = snap.docs.map((d) => {
        const data = d.data() as WalkerPresence
        const heartbeatSeconds = data.lastHeartbeat?.seconds ?? 0
        const minutesSinceHeartbeat = heartbeatSeconds > 0
          ? Math.round((now / 1000 - heartbeatSeconds) / 60)
          : 999
        return { ...data, minutesSinceHeartbeat }
      })

      walkers = walkers.filter((w) => w.minutesSinceHeartbeat < STALE_THRESHOLD_SECONDS)

      if (zoneId) {
        walkers = walkers.filter((w) => w.currentZoneId === zoneId)
      }

      if (!cancelled) {
        setResult({ loading: false, onlineWalkers: walkers, totalOnline: walkers.length })
      }
    }, () => {
      if (!cancelled) setResult({ loading: false, onlineWalkers: [], totalOnline: 0 })
    })

    return () => { cancelled = true; unsub() }
  }, [zoneId])

  return result
}
