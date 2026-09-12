import { NextResponse } from 'next/server'
import { verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { createPrivateDownloadUrl } from '@/lib/media/privateMediaAdmin.server'
import { MAX_DOG_PHOTO_LOOKUPS, isDogPhotoReference } from '@/lib/dogPhotos'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 120
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const LINK_TTL_SECONDS = 600

/**
 * Enlaces temporales a las fotos de unos perros.
 *
 * Quién puede verlas: el equipo, y la familia dueña de cada perro. Se piden
 * varios de un jalón porque la lista de perros los muestra juntos: pedir uno por
 * uno serían diez peticiones para pintar una pantalla. Cada enlace caduca a los
 * LINK_TTL_SECONDS, así que un URL copiado deja de mostrar la foto. Un perro que
 * no le toca al que pregunta simplemente no viene en la respuesta.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const caller = await verifyTokenRole(idToken)
  if (!caller) return NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })

  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) {
    return NextResponse.json({ code: 'private-media-not-enabled' }, { status: 503, headers: noStore })
  }

  const rateLimit = checkRateLimit(`dog-photos:${caller.uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { dogIds?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  const dogIds = (Array.isArray(body.dogIds) ? body.dogIds : [])
    .filter((id): id is string => typeof id === 'string' && id.trim() !== '' && !id.includes('/'))
    .map((id) => id.trim())
    .slice(0, MAX_DOG_PHOTO_LOOKUPS)
  if (dogIds.length === 0) return NextResponse.json({ code: 'ok', photos: [] }, { headers: noStore })

  const isStaff = caller.role === 'admin' || caller.role === 'supervisor'

  try {
    const snapshots = await Promise.all(dogIds.map((id) => firestore.collection('dogs').doc(id).get()))
    const photos: Array<{ dogId: string; url: string }> = []
    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue
      const dog = snapshot.data() ?? {}
      if (!isStaff && dog.ownerId !== caller.uid) continue
      if (!isDogPhotoReference(dog.photoReference)) continue
      photos.push({ dogId: snapshot.id, url: createPrivateDownloadUrl(dog.photoReference, { ttlSeconds: LINK_TTL_SECONDS }) })
    }
    return NextResponse.json({ code: 'ok', photos, expiresInSeconds: LINK_TTL_SECONDS }, { headers: noStore })
  } catch (error) {
    console.error('media/private/dog-photos failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'dog-photos-failed' }, { status: 500, headers: noStore })
  }
}
