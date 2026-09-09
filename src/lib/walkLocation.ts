'use client'

import { Timestamp } from 'firebase/firestore'

/**
 * Ubicación de inicio y fin del paseo.
 *
 * Only those two moments are recorded. There is no continuous tracking, so a
 * session never stores a route -- which keeps the amount of location data held
 * about a walker to the minimum that answers "did the walk start and end where
 * it was supposed to".
 *
 * Capture is best-effort by design: a phone without GPS, a denied permission,
 * or a slow fix all resolve to null so the walker can still advance the walk.
 * Blocking a walk on a location read would make the panel unusable indoors.
 */

const TIMEOUT_MS = 8000
const MAX_AGE_MS = 30_000

export interface WalkPoint {
  lat: number
  lng: number
  accuracy: number
  capturedAt: Timestamp
}

export type WalkPointField = 'startLocation' | 'endLocation'

/** Which transition, if any, records a location. */
export function locationFieldForTransition(to: string): WalkPointField | null {
  if (to === 'in_progress') return 'startLocation'
  if (to === 'completed') return 'endLocation'
  return null
}

export async function captureWalkPoint(): Promise<WalkPoint | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null

  return new Promise<WalkPoint | null>((resolve) => {
    let settled = false
    const finish = (value: WalkPoint | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        // A reading the browser cannot bound is not worth storing: it would
        // look like evidence of where the walk happened without being any.
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) {
          finish(null)
          return
        }
        finish({
          lat: latitude,
          lng: longitude,
          accuracy: Math.min(Math.round(accuracy), 100_000),
          capturedAt: Timestamp.fromMillis(position.timestamp || Date.now()),
        })
      },
      () => finish(null),
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: MAX_AGE_MS },
    )

    // Safari has been known to call neither callback when permission state is
    // in flux, so the walk must not hang waiting for one.
    setTimeout(() => finish(null), TIMEOUT_MS + 1000)
  })
}

export function formatWalkPoint(point: { lat: number; lng: number; accuracy?: number } | null | undefined): string {
  if (!point) return 'Sin ubicación registrada'
  const accuracy = typeof point.accuracy === 'number' ? ` · ±${point.accuracy} m` : ''
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}${accuracy}`
}

export function mapsUrlForPoint(point: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`
}
