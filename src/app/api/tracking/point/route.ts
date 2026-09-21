import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from '@google-cloud/firestore'
import { verifyWalkerToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { isOutsideZone, isUsableCenter } from '@/lib/geo'
import { trackingExpiryDate } from '@/lib/trackingRetention'
import { buildGeofencePush, geofenceNotifyReason, type NotifyReason } from '@/lib/geofenceAlert'
import { notifyStaff } from '@/lib/push/staffPush'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * Punto de ubicación durante un paseo en curso, y alerta si sale de su zona.
 *
 * The walker's phone reports where it is; it does not get to say whether that
 * is inside or outside. The server reads the session (it must be this
 * walker's and `in_progress`), its address and the address's zone, and decides.
 * Points and alerts live in collections no browser can write -- the rules let
 * staff read them and only acknowledge an alert.
 *
 * Only while a walk is in progress: nothing is recorded before pickup or after
 * the walk ends. Fails closed behind WALK_TRACKING_ENABLED.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const walkerUid = await verifyWalkerToken(idToken)
  if (!walkerUid) return NextResponse.json({ code: 'walker-required' }, { status: 403, headers: noStore })

  if (!FEATURE_FLAGS.WALK_TRACKING_ENABLED) {
    return NextResponse.json({ code: 'tracking-not-enabled' }, { status: 503, headers: noStore })
  }

  const rateLimit = checkRateLimit(`tracking:${walkerUid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { sessionId?: unknown; lat?: unknown; lng?: unknown; accuracy?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  const point = { lat: body.lat, lng: body.lng }
  const accuracy = typeof body.accuracy === 'number' && Number.isFinite(body.accuracy) && body.accuracy >= 0 && body.accuracy <= 100_000
    ? Math.round(body.accuracy)
    : null
  if (!sessionId || sessionId.includes('/') || !isUsableCenter(point) || accuracy === null) {
    return NextResponse.json({ code: 'invalid-point' }, { status: 400, headers: noStore })
  }

  try {
    const sessionSnapshot = await firestore.collection('walkSessions').doc(sessionId).get()
    const session = sessionSnapshot.exists ? sessionSnapshot.data() ?? {} : null
    if (!session || session.walkerId !== walkerUid) {
      return NextResponse.json({ code: 'session-not-assigned' }, { status: 403, headers: noStore })
    }
    if (session.status !== 'in_progress') {
      return NextResponse.json({ code: 'session-not-in-progress' }, { status: 409, headers: noStore })
    }

    const addressId = typeof session.addressId === 'string' ? session.addressId : ''
    const address = addressId ? (await firestore.collection('addresses').doc(addressId).get()).data() ?? null : null
    const zoneId = typeof address?.zoneId === 'string' ? address.zoneId : ''
    const zone = zoneId ? (await firestore.collection('zones').doc(zoneId).get()).data() ?? null : null
    const radiusKm = typeof zone?.radius === 'number' && zone.radius > 0 ? zone.radius : null
    const zoneName = typeof zone?.name === 'string' ? zone.name : ''
    const verdict = zone && isUsableCenter(zone.center) && radiusKm !== null
      ? isOutsideZone(point, accuracy, zone.center, radiusKm)
      : null

    const now = Timestamp.now()
    // Cada punto nace con su fecha de caducidad: la política TTL de Firestore
    // lo borra sola a los TRACKING_RETENTION_DAYS días. Ver trackingRetention.ts.
    const expiresAt = Timestamp.fromDate(trackingExpiryDate(now.toDate()))
    await firestore.collection('walkTracks').doc(sessionId).collection('points').add({
      lat: point.lat,
      lng: point.lng,
      accuracy,
      outside: verdict?.outside ?? null,
      distanceMeters: verdict?.distanceMeters ?? null,
      walkerId: walkerUid,
      capturedAt: now,
      expiresAt,
    })

    if (verdict?.outside && zone && isUsableCenter(zone.center)) {
      const walkerName = (await firestore.collection('walkerProfiles').doc(walkerUid).get()).data()?.name
      const alertRef = firestore.collection('geofenceAlerts').doc(sessionId)
      const zoneCenter = { lat: zone.center.lat, lng: zone.center.lng }
      const resolvedWalkerName = typeof walkerName === 'string' && walkerName.trim() ? walkerName.trim() : 'Paseador'
      const notifyReason: NotifyReason | null = await firestore.runTransaction(async (transaction) => {
        const existing = await transaction.get(alertRef)
        const existingData = existing.data()
        const lastNotified = existingData?.lastNotifiedAt
        // Una lectura fuera no es un aviso: la primera, la que reabre una alerta ya
        // marcada, y el recordatorio de una que nadie atiende (ver geofenceAlert.ts).
        const reason = geofenceNotifyReason(
          existing.exists
            ? {
                status: typeof existingData?.status === 'string' ? existingData.status : undefined,
                lastNotifiedAtMs: lastNotified && typeof lastNotified.toMillis === 'function' ? lastNotified.toMillis() : undefined,
              }
            : null,
          now.toMillis(),
        )
        const shared = {
          status: 'open',
          ...(reason ? { lastNotifiedAt: now } : {}),
          lastOutsideAt: now,
          lastPoint: { lat: point.lat, lng: point.lng, accuracy },
          distanceMeters: verdict.distanceMeters,
          // La alerta guarda una ubicación, así que caduca igual que los puntos.
          expiresAt,
        }
        if (!existing.exists) {
          transaction.set(alertRef, {
            ...shared,
            sessionId,
            walkerId: walkerUid,
            walkerName: resolvedWalkerName,
            customerId: String(session.customerId ?? ''),
            zoneId,
            zoneName,
            zoneCenter,
            radiusKm,
            firstOutsideAt: now,
            outsideCount: 1,
          })
        } else {
          transaction.update(alertRef, {
            ...shared,
            outsideCount: FieldValue.increment(1),
            // Back outside after an admin marked it as seen: it needs eyes again.
            ...(existing.data()?.status === 'acknowledged' ? { reopenedAt: now } : {}),
          })
        }
        return reason
      })

      // Al teléfono de quien opera. Nunca tumba el registro del punto: si el aviso
      // falla, la alerta ya está guardada y se ve en el panel.
      if (notifyReason) {
        try {
          await notifyStaff(firestore, buildGeofencePush({ walkerName: resolvedWalkerName, zoneName, sessionId, reason: notifyReason }))
        } catch (error) {
          console.error('tracking/point staff push failed:', error instanceof Error ? error.message : String(error))
        }
      }
    }

    return NextResponse.json({
      code: verdict ? 'ok' : 'no-zone',
      inside: verdict ? !verdict.outside : null,
      zoneName,
    }, { headers: noStore })
  } catch (error) {
    console.error('tracking/point failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'tracking-failed' }, { status: 500, headers: noStore })
  }
}
