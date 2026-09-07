'use client'

import { useEffect, useRef, useCallback } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { PresenceStatus } from '@/types'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

const HEARTBEAT_INTERVAL_MS = 15000

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
  const positionRef = useRef<GeolocationPosition | null>(null)
  const statusRef = useRef<PresenceStatus>('online')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendHeartbeat = useCallback(async (status: PresenceStatus, pos?: GeolocationPosition | null) => {
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED || !walkerId) return
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
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[walker-presence] No se pudo actualizar la presencia.', {
          code: error && typeof error === 'object' && 'code' in error
            ? String((error as { code?: unknown }).code)
            : 'unknown',
        })
      }
    }
  }, [walkerId, walkerName])

  const startHeartbeat = useCallback(async () => {
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED || !enabled || !walkerId) return

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

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
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED || !enabled || !walkerId) return

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
      if (FEATURE_FLAGS.PET_AHORA_ENABLED) navigator.sendBeacon?.(
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
