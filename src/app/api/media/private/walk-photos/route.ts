import { NextResponse } from 'next/server'
import { verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { createPrivateDownloadUrl } from '@/lib/media/privateMediaAdmin.server'
import { MAX_WALK_PHOTOS, isWalkPhotoReference } from '@/lib/walkReports'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const LINK_TTL_SECONDS = 600

/**
 * Enlaces temporales a las fotos privadas de un paseo.
 *
 * Who may look: staff; the walker assigned to the session (draft included,
 * it is their working copy); and the family that owns the session, but only
 * once the report has been submitted -- the same moment the text becomes
 * visible to them. Identity comes from the verified ID token and the stored
 * session, never from the body. Each link expires after LINK_TTL_SECONDS, so
 * a copied URL stops exposing a family's photo. Fails closed behind
 * PRIVATE_MEDIA_UPLOADS_ENABLED.
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

  const rateLimit = checkRateLimit(`walk-photos:${caller.uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
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
    const [sessionSnapshot, reportSnapshot] = await Promise.all([
      firestore.collection('walkSessions').doc(sessionId).get(),
      firestore.collection('walkReports').doc(sessionId).get(),
    ])
    if (!sessionSnapshot.exists) return NextResponse.json({ code: 'not-found' }, { status: 404, headers: noStore })
    const session = sessionSnapshot.data() ?? {}

    const isStaff = caller.role === 'admin' || caller.role === 'supervisor'
    const isAssignedWalker = caller.role === 'walker' && session.walkerId === caller.uid
    const isFamily = session.customerId === caller.uid
    if (!isStaff && !isAssignedWalker && !isFamily) {
      return NextResponse.json({ code: 'forbidden' }, { status: 403, headers: noStore })
    }

    const report = reportSnapshot.exists ? reportSnapshot.data() ?? {} : null
    const familyOnly = isFamily && !isStaff && !isAssignedWalker
    if (!report || (familyOnly && report.status !== 'submitted')) {
      return NextResponse.json({ code: 'ok', photos: [] }, { headers: noStore })
    }

    const references = (Array.isArray(report.mediaReferences) ? report.mediaReferences : [])
      .filter(isWalkPhotoReference)
      .slice(0, MAX_WALK_PHOTOS)

    let photos: Array<{ reference: string; url: string }>
    try {
      photos = references.map((reference: string) => ({
        reference,
        url: createPrivateDownloadUrl(reference, { ttlSeconds: LINK_TTL_SECONDS }),
      }))
    } catch {
      return NextResponse.json({ code: 'signed-media-not-configured' }, { status: 503, headers: noStore })
    }

    return NextResponse.json({ code: 'ok', photos, expiresInSeconds: LINK_TTL_SECONDS }, { headers: noStore })
  } catch (error) {
    console.error('media/private/walk-photos failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'walk-photos-failed' }, { status: 500, headers: noStore })
  }
}
