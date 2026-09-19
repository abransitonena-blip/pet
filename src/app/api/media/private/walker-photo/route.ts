import { NextResponse } from 'next/server'
import { verifyAuthenticatedToken, verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { createPrivateDownloadUrl } from '@/lib/media/privateMediaAdmin.server'
import { isWalkerPhotoReference } from '@/lib/walkerPhotos'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const LINK_TTL_SECONDS = 600

/**
 * Quién lleva este paseo: su nombre y su foto, para la familia que va a abrir
 * la puerta.
 *
 * No se pregunta por un paseador, se pregunta por un paseo. El servidor lee la
 * sesión y decide: la familia dueña de ese paseo, el paseador asignado, o el
 * equipo. Así una familia nunca puede pedir la foto de alguien que no va a su
 * casa, ni recorrer la lista de paseadores.
 *
 * El enlace caduca a los diez minutos, como el resto de las fotos privadas.
 */
type PrivilegedFirestore = NonNullable<ReturnType<typeof getPrivilegedFirestore>>

/**
 * El nombre y la foto, nada más: ni su teléfono, ni su correo, ni sus zonas.
 * Quien abre la puerta necesita reconocerlo, no su expediente.
 */
async function respondWithWalker(firestore: PrivilegedFirestore, walkerId: string) {
  const snapshot = await firestore.collection('walkerProfiles').doc(walkerId).get()
  const walker = snapshot.exists ? snapshot.data() ?? {} : null
  if (!walker) return NextResponse.json({ code: 'ok', walker: null }, { headers: noStore })

  let photoUrl = ''
  if (isWalkerPhotoReference(walker.photoReference)) {
    try {
      photoUrl = createPrivateDownloadUrl(walker.photoReference, { ttlSeconds: LINK_TTL_SECONDS })
    } catch {
      // Sin credenciales de Cloudinary queda el nombre, que ya es algo.
    }
  }

  return NextResponse.json({
    code: 'ok',
    walker: { name: typeof walker.name === 'string' ? walker.name : 'Paseador', photoUrl },
  }, { headers: noStore })
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const caller = await verifyTokenRole(idToken)
  if (!caller) {
    // Un token válido cuyo rol no pasa -- un paseador con perfil inactivo o
    // suspendido, por ejemplo -- no es lo mismo que una sesión caducada, y
    // llamarlos igual deja un 401 en la consola que no explica nada.
    const authenticated = await verifyAuthenticatedToken(idToken)
    return authenticated
      ? NextResponse.json({ code: 'role-not-allowed' }, { status: 403, headers: noStore })
      : NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })
  }

  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) {
    return NextResponse.json({ code: 'private-media-not-enabled' }, { status: 503, headers: noStore })
  }

  const rateLimit = checkRateLimit(`walker-photo:${caller.uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { sessionId?: unknown; self?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }

  // Un paseador pidiendo la suya no necesita un paseo de por medio.
  if (body.self === true) {
    if (caller.role !== 'walker') return NextResponse.json({ code: 'walker-required' }, { status: 403, headers: noStore })
    return respondWithWalker(firestore, caller.uid)
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId || sessionId.includes('/')) {
    return NextResponse.json({ code: 'invalid-session-id' }, { status: 400, headers: noStore })
  }

  try {
    const sessionSnapshot = await firestore.collection('walkSessions').doc(sessionId).get()
    const session = sessionSnapshot.exists ? sessionSnapshot.data() ?? {} : null
    if (!session) return NextResponse.json({ code: 'not-found' }, { status: 404, headers: noStore })

    const isStaff = caller.role === 'admin' || caller.role === 'supervisor'
    const isFamily = session.customerId === caller.uid
    const isAssignedWalker = session.walkerId === caller.uid
    if (!isStaff && !isFamily && !isAssignedWalker) {
      return NextResponse.json({ code: 'session-not-yours' }, { status: 403, headers: noStore })
    }

    const walkerId = typeof session.walkerId === 'string' ? session.walkerId : ''
    // Un paseo sin paseador asignado no tiene a quién mostrar: no es un error.
    if (!walkerId) return NextResponse.json({ code: 'ok', walker: null }, { headers: noStore })
    return respondWithWalker(firestore, walkerId)
  } catch (error) {
    console.error('media/private/walker-photo failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'walker-photo-failed' }, { status: 500, headers: noStore })
  }
}
