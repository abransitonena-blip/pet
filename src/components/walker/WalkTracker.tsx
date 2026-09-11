'use client'

import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { AlertTriangle, LocateFixed, MapPinOff } from 'lucide-react'
import { db } from '@/firebase/config'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

/**
 * Comparte la ubicación mientras hay un paseo en curso.
 *
 * Owner decision: every ~2 minutes during a walk, so administration is warned
 * if a walker leaves the zone. It runs only while a session of this walker is
 * `in_progress`, and says so on screen the whole time. A browser cannot read
 * location with the phone locked or the app in the background, so the walker
 * is told to keep this screen open -- claiming otherwise would be false comfort.
 */

const TRACK_INTERVAL_MS = 2 * 60_000

type ShareState = 'sharing' | 'denied' | 'unavailable'

export default function WalkTracker({ uid }: { uid: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [shareState, setShareState] = useState<ShareState>('sharing')
  const [zone, setZone] = useState<{ inside: boolean | null; name: string } | null>(null)

  useEffect(() => {
    if (!FEATURE_FLAGS.WALK_TRACKING_ENABLED || !uid) return
    return onSnapshot(
      query(collection(db, 'walkSessions'), where('walkerId', '==', uid), where('status', '==', 'in_progress'), limit(1)),
      (snapshot) => setSessionId(snapshot.docs[0]?.id ?? null),
      () => setSessionId(null),
    )
  }, [uid])

  useEffect(() => {
    setZone(null)
    if (!sessionId) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setShareState('unavailable')
      return
    }

    let cancelled = false
    setShareState('sharing')

    const report = (position: GeolocationPosition) => {
      void (async () => {
        try {
          const { auth } = await import('@/firebase/config')
          const idToken = await auth.currentUser?.getIdToken()
          if (!idToken || cancelled) return
          const response = await fetch('/api/tracking/point', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              sessionId,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }),
          })
          const data = await response.json().catch(() => ({})) as { inside?: unknown; zoneName?: unknown }
          if (!cancelled && response.ok) {
            setZone({ inside: typeof data.inside === 'boolean' ? data.inside : null, name: typeof data.zoneName === 'string' ? data.zoneName : '' })
          }
        } catch {
          // A missed point is retried on the next tick; the walk itself goes on.
        }
      })()
    }

    const sample = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return
          setShareState('sharing')
          report(position)
        },
        (error) => {
          if (!cancelled) setShareState(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
      )
    }

    sample()
    const timer = window.setInterval(sample, TRACK_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sessionId])

  if (!FEATURE_FLAGS.WALK_TRACKING_ENABLED || !sessionId) return null

  if (shareState !== 'sharing') {
    return (
      <p role="alert" className="mb-4 flex items-start gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-amber-900">
        <MapPinOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        {shareState === 'denied'
          ? 'La ubicación está bloqueada para este sitio. Actívala en el navegador para compartirla durante el paseo.'
          : 'No pudimos obtener tu ubicación. Revisa que el GPS del teléfono esté activo.'}
      </p>
    )
  }

  if (zone?.inside === false) {
    return (
      <p role="alert" className="mb-4 flex items-start gap-2 rounded-2xl bg-danger-500/10 px-4 py-3 text-sm text-red-700">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        Estás fuera de la zona del paseo{zone.name ? ` (${zone.name})` : ''}. Administración ya recibió el aviso; regresa a la zona.
      </p>
    )
  }

  return (
    <p role="status" className="mb-4 flex items-start gap-2 rounded-2xl bg-primary/[0.06] px-4 py-3 text-xs text-ink">
      <LocateFixed size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
      Paseo en curso: tu ubicación se comparte con administración cada 2 minutos, solo hasta completar el paseo. Mantén esta pantalla abierta; con el teléfono bloqueado no se puede enviar.
    </p>
  )
}
