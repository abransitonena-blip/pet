import { NextResponse } from 'next/server'
import { verifyAuthenticatedToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const MAX_POINTS = 300

/**
 * El recorrido de un paseo, para la familia dueña de ese paseo.
 *
 * Las reglas sólo dejan que el equipo lea `walkTracks/{id}/points`, y con razón:
 * una regla por documento tendría que consultar la sesión en cada punto del
 * recorrido, y Firestore corta esas consultas anidadas. Así que el permiso lo
 * resuelve el servidor una sola vez -- confirma que la sesión es de quien
 * pregunta -- y devuelve los puntos de ese paseo y nada más.
 *
 * Falla cerrado: sin identidad privilegiada no responde nada, igual que la
 * ficha del paseador.
 */

interface TrackPoint {
  lat: number
  lng: number
  outside: boolean
  at: number | null
}

function point(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return typeof data.lat === 'number' && typeof data.lng === 'number' ? { lat: data.lat, lng: data.lng } : null
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const uid = await verifyAuthenticatedToken(idToken)
  if (!uid) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })

  const rateLimit = checkRateLimit(`family-walk-track:${uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { sessionId?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId || sessionId.includes('/')) {
    return NextResponse.json({ code: 'invalid-session-id' }, { status: 400, headers: noStore })
  }

  try {
    const sessionSnapshot = await firestore.collection('walkSessions').doc(sessionId).get()
    const session = sessionSnapshot.exists ? sessionSnapshot.data() ?? {} : null
    if (!session || session.customerId !== uid) {
      return NextResponse.json({ code: 'session-not-yours' }, { status: 403, headers: noStore })
    }

    const snapshot = await firestore
      .collection('walkTracks').doc(sessionId).collection('points')
      .orderBy('capturedAt', 'asc')
      .limit(MAX_POINTS)
      .get()

    const points: TrackPoint[] = snapshot.docs.flatMap((item) => {
      const data = item.data()
      if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return []
      const capturedAt = data.capturedAt as { seconds?: unknown } | undefined
      return [{
        lat: data.lat,
        lng: data.lng,
        outside: data.outside === true,
        at: typeof capturedAt?.seconds === 'number' ? capturedAt.seconds * 1000 : null,
      }]
    })

    return NextResponse.json({
      code: 'ok',
      points,
      start: point(session.startLocation),
      end: point(session.endLocation),
    }, { headers: noStore })
  } catch (error) {
    console.error('family/walk-track failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'walk-track-failed' }, { status: 500, headers: noStore })
  }
}
