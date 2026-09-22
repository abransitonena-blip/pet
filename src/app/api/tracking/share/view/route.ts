import { NextResponse } from 'next/server'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { isShareLinkActive, isShareToken } from '@/lib/locationShare'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 40
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const MAX_POINTS = 100

/**
 * Lo que ve quien abre un enlace compartido, sin cuenta.
 *
 * Lo mínimo: puntos del recorrido y si el paseo sigue en curso. Nunca la
 * marca de "fuera del área" -- eso es entre la familia y administración, y un
 * enlace que cualquiera puede reenviar no es el lugar para exponerlo -- ni el
 * nombre del perro, del paseador o de la familia. El token inválido, vencido
 * o revocado da la misma respuesta: no hay por qué distinguirle a quien mira
 * cuál de las tres pasó.
 */

function point(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return typeof data.lat === 'number' && typeof data.lng === 'number' ? { lat: data.lat, lng: data.lng } : null
}

export async function POST(request: Request) {
  if (!FEATURE_FLAGS.LOCATION_SHARE_LINKS_ENABLED) {
    return NextResponse.json({ code: 'location-share-not-enabled' }, { status: 503, headers: noStore })
  }

  let body: { token?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  if (!isShareToken(body.token)) {
    return NextResponse.json({ code: 'not-found' }, { status: 404, headers: noStore })
  }
  const token = body.token

  const rateLimit = checkRateLimit(`share-view:${token}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  try {
    const shareSnapshot = await firestore.collection('walkShareLinks').doc(token).get()
    const share = shareSnapshot.exists ? shareSnapshot.data() ?? {} : null
    const expiresAtMs = typeof share?.expiresAt?.toMillis === 'function' ? share.expiresAt.toMillis() : 0
    const revokedAtMs = share?.revokedAt && typeof share.revokedAt.toMillis === 'function' ? share.revokedAt.toMillis() : null
    if (!share || !isShareLinkActive({ revokedAtMs, expiresAtMs }, Date.now())) {
      return NextResponse.json({ code: 'not-found' }, { status: 404, headers: noStore })
    }

    const sessionId = typeof share.sessionId === 'string' ? share.sessionId : ''
    const sessionSnapshot = sessionId ? await firestore.collection('walkSessions').doc(sessionId).get() : null
    const session = sessionSnapshot?.exists ? sessionSnapshot.data() ?? {} : null

    const pointsSnapshot = sessionId
      ? await firestore.collection('walkTracks').doc(sessionId).collection('points')
        .orderBy('capturedAt', 'asc').limit(MAX_POINTS).get()
      : null

    const points = (pointsSnapshot?.docs ?? []).flatMap((item) => {
      const value = point(item.data())
      return value ? [value] : []
    })

    return NextResponse.json({
      code: 'ok',
      active: session?.status === 'in_progress',
      start: point(session?.startLocation),
      end: point(session?.endLocation),
      points,
      expiresAt: expiresAtMs,
    }, { headers: noStore })
  } catch (error) {
    console.error('tracking/share/view failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'share-view-failed' }, { status: 500, headers: noStore })
  }
}
