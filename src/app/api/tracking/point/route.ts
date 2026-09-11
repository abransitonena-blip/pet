import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from '@google-cloud/firestore'
import { verifyWalkerToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { isOutsideZone, isUsableCenter } from '@/lib/geo'

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
    await firestore.collection('walkTracks').doc(sessionId).collection('points').add({
      lat: point.lat,
      lng: point.lng,
      accuracy,
      outside: verdict?.outside ?? null,
      distanceMeters: verdict?.distanceMeters ?? null,
      walkerId: walkerUid,
      capturedAt: now,
    })

    if (verdict?.outside && zone && isUsableCenter(zone.center)) {
      const walkerName = (await firestore.collection('walkerProfiles').doc(walkerUid).get()).data()?.name
      const alertRef = firestore.collection('geofenceAlerts').doc(sessionId)
      const zoneCenter = { lat: zone.center.lat, lng: zone.center.lng }
      await firestore.runTransaction(async (transaction) => {
        const existing = await transaction.get(alertRef)
        const shared = {
          status: 'open',
          lastOutsideAt: now,
          lastPoint: { lat: point.lat, lng: point.lng, accuracy },
          distanceMeters: verdict.distanceMeters,
        }
        if (!existing.exists) {
          transaction.set(alertRef, {
            ...shared,
            sessionId,
            walkerId: walkerUid,
            walkerName: typeof walkerName === 'string' && walkerName.trim() ? walkerName.trim() : 'Paseador',
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
      })
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
