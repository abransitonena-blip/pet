import { NextResponse } from 'next/server'
import { Timestamp } from '@google-cloud/firestore'
import { verifyAuthenticatedToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { clampShareMinutes, generateShareToken } from '@/lib/locationShare'
import { absoluteUrl } from '@/lib/siteUrl'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * La familia crea un enlace temporal para que alguien sin cuenta vea por
 * dónde va un paseo, sin pedirle que entre a la app.
 *
 * Fail-closed detrás de FEATURE_FLAGS.LOCATION_SHARE_LINKS_ENABLED -- ver ese
 * flag para el porqué (aviso de privacidad pendiente de validación legal).
 *
 * Sólo la familia dueña del paseo (comparado contra la sesión guardada, nunca
 * contra un rol) y sólo mientras sigue `in_progress`: compartir un paseo que
 * no está ocurriendo no tiene qué mostrar. El token es aleatorio y es el id
 * del documento -- ver locationShare.ts --, así que la regla de Firestore
 * puede cerrarse por completo y sólo esta ruta, con identidad privilegiada,
 * decide quién obtiene uno.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const uid = await verifyAuthenticatedToken(idToken)
  if (!uid) return NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })

  if (!FEATURE_FLAGS.LOCATION_SHARE_LINKS_ENABLED) {
    return NextResponse.json({ code: 'location-share-not-enabled' }, { status: 503, headers: noStore })
  }

  const rateLimit = checkRateLimit(`share-create:${uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { sessionId?: unknown; minutes?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId || sessionId.includes('/')) {
    return NextResponse.json({ code: 'invalid-session-id' }, { status: 400, headers: noStore })
  }
  const minutes = clampShareMinutes(body.minutes)

  try {
    const sessionSnapshot = await firestore.collection('walkSessions').doc(sessionId).get()
    const session = sessionSnapshot.exists ? sessionSnapshot.data() ?? {} : null
    if (!session || session.customerId !== uid) {
      return NextResponse.json({ code: 'session-not-yours' }, { status: 403, headers: noStore })
    }
    if (session.status !== 'in_progress') {
      return NextResponse.json({ code: 'session-not-active' }, { status: 409, headers: noStore })
    }

    const now = Timestamp.now()
    const expiresAt = Timestamp.fromMillis(now.toMillis() + minutes * 60_000)
    const token = generateShareToken()

    await firestore.collection('walkShareLinks').doc(token).set({
      sessionId,
      customerId: uid,
      createdAt: now,
      expiresAt,
      revokedAt: null,
    })

    return NextResponse.json({
      code: 'ok',
      token,
      url: absoluteUrl(`/seguimiento/${token}`),
      expiresAt: expiresAt.toMillis(),
    }, { headers: noStore })
  } catch (error) {
    console.error('tracking/share/create failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'share-create-failed' }, { status: 500, headers: noStore })
  }
}
