import { NextResponse } from 'next/server'
import { verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const MAX_POINTS = 300

/**
 * El recorrido de un paseo, para quien tiene algo que ver con ese paseo.
 *
 * Las reglas sólo dejan que el equipo lea `walkTracks/{id}/points`, y con razón:
 * una regla por documento tendría que consultar la sesión en cada punto del
 * recorrido, y Firestore corta esas consultas anidadas. Así que el permiso lo
 * resuelve el servidor una sola vez, contra la sesión guardada: la familia dueña
 * del paseo, el paseador que lo hizo, o el equipo. Cualquier otro no recibe nada.
 *
 * El paseador ve su propio recorrido porque es lo que caminó; no le sirve de
 * nada la lista de coordenadas, pero el mapa le dice por dónde anduvo y si se
 * salió del área recomendada.
 *
 * La familia ve el recorrido, pero NO la marca de "fuera del área" de cada punto
 * hasta que administración decide avisarle. La salida se alerta primero a
 * administración, para que revise si fue un percance o una vuelta más larga por
 * el parque; enseñarle a la familia un punto rojo antes de eso es asustarla con
 * una lectura de GPS que nadie ha juzgado. El servidor lo decide, no la
 * pantalla: lo que llega al teléfono de la familia no lleva la marca.
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
  const caller = await verifyTokenRole(idToken)
  if (!caller) return NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })

  const rateLimit = checkRateLimit(`walk-track:${caller.uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
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
    const isStaff = caller.role === 'admin' || caller.role === 'supervisor'
    const isAssignedWalker = session !== null && session.walkerId === caller.uid
    const isFamily = session !== null && session.customerId === caller.uid
    if (!session || (!isStaff && !isAssignedWalker && !isFamily)) {
      return NextResponse.json({ code: 'session-not-yours' }, { status: 403, headers: noStore })
    }

    // Sólo la familia (y nadie más que la familia) necesita que se le oculte la marca.
    const familyOnly = isFamily && !isStaff && !isAssignedWalker
    let showOutside = !familyOnly
    if (familyOnly) {
      const alert = await firestore.collection('geofenceAlerts').doc(sessionId).get()
      showOutside = alert.exists && Boolean(alert.data()?.familyNotifiedAt)
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
        outside: showOutside && data.outside === true,
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
    console.error('walks/track failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'walk-track-failed' }, { status: 500, headers: noStore })
  }
}
