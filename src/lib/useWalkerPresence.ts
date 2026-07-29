'use client'

import { useEffect, useRef, useCallback } from 'react'
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useRouter } from 'next/navigation'
import type { PresenceStatus } from '@/types'

const HEARTBEAT_INTERVAL_MS = 15000
const STALE_THRESHOLD_MS = 60000

interface UseWalkerPresenceOptions {
  walkerId: string
  walkerName: string
  enabled?: boolean
}

interface GeolocationPosition {
  lat: number
  lng: number
}

export function useWalkerPresence({ walkerId, walkerName, enabled = true }: UseWalkerPresenceOptions) {
  const router = useRouter()
  const positionRef = useRef<GeolocationPosition | null>(null)
  const statusRef = useRef<PresenceStatus>('online')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendHeartbeat = useCallback(async (status: PresenceStatus, pos?: GeolocationPosition | null) => {
    if (!walkerId) return
    try {
      await setDoc(doc(db, 'walkerPresence', walkerId), {
        walkerId,
        walkerName,
        status,
        lastHeartbeat: serverTimestamp(),
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        batteryLevel: null,
      }, { merge: true })
    } catch {
      // silently fail — presence is best-effort
    }
  }, [walkerId, walkerName])

  const startHeartbeat = useCallback(async () => {
    if (!enabled || !walkerId) return

    statusRef.current = 'online'

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          positionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        },
        () => {
          positionRef.current = null
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      )
    }

    await sendHeartbeat('online', positionRef.current)

    intervalRef.current = setInterval(async () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            positionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
        )
      }
      await sendHeartbeat('online', positionRef.current)
    }, HEARTBEAT_INTERVAL_MS)
  }, [enabled, walkerId, sendHeartbeat])

  useEffect(() => {
    if (!enabled || !walkerId) return

    startHeartbeat()

    const handleVisibility = () => {
      if (document.hidden) {
        sendHeartbeat('offline', positionRef.current)
      } else {
        startHeartbeat()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const handleBeforeUnload = () => {
      navigator.sendBeacon?.(
        `/api/presence-offline?walkerId=${walkerId}`
      )
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      sendHeartbeat('offline', positionRef.current)
    }
  }, [enabled, walkerId, startHeartbeat, sendHeartbeat])

  const setBusy = useCallback(async () => {
    statusRef.current = 'busy'
    await sendHeartbeat('busy', positionRef.current)
  }, [sendHeartbeat])

  const setOnline = useCallback(async () => {
    statusRef.current = 'online'
    await sendHeartbeat('online', positionRef.current)
  }, [sendHeartbeat])

  return { setBusy, setOnline }
}
