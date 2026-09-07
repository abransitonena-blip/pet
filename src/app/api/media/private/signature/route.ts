import { NextResponse } from 'next/server'
import { verifyAdminToken, verifyWalkerToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { createCloudinaryPrivateUploadSignature } from '@/lib/media/privateMediaAdmin.server'
import { isAssignedToWalker } from '@/lib/walkerPanel'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const ALLOWED_FOLDERS = new Set(['pet-ap-private/walk-reports', 'pet-ap-private/pet-ahora', 'pet-ap-private/incidents'])

/**
 * M1 signed upload for operational (private) photos. Unlike the public
 * gallery signature, this always signs an `authenticated` delivery-type
 * asset -- the URL alone never grants access. A Walker may only request a
 * signature for a session actually assigned to them (verified server-side
 * against walkSessions, via the T3 privileged Firestore client, not trusted
 * from the request body). Fail-closed behind PRIVATE_MEDIA_UPLOADS_ENABLED,
 * which stays off per MEDIA_POLICY.md ("uploads permanecen desactivados").
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })

  const adminUid = await verifyAdminToken(token)
  const walkerUid = adminUid ? null : await verifyWalkerToken(token)
  if (!adminUid && !walkerUid) return NextResponse.json({ code: 'admin-or-walker-required' }, { status: 403, headers: noStore })

  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) {
    return NextResponse.json({ code: 'private-media-uploads-not-enabled' }, { status: 503, headers: noStore })
  }

  let body: { folder?: unknown; sessionId?: unknown }
  try {
    body = await request.json() as { folder?: unknown; sessionId?: unknown }
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  if (typeof body.folder !== 'string' || !ALLOWED_FOLDERS.has(body.folder)) {
    return NextResponse.json({ code: 'invalid-folder' }, { status: 400, headers: noStore })
  }

  if (walkerUid) {
    if (typeof body.sessionId !== 'string' || !body.sessionId) {
      return NextResponse.json({ code: 'session-id-required' }, { status: 400, headers: noStore })
    }
    const firestore = getPrivilegedFirestore()
    if (!firestore) return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
    const sessionSnap = await firestore.collection('walkSessions').doc(body.sessionId).get()
    if (!sessionSnap.exists) return NextResponse.json({ code: 'session-not-found' }, { status: 404, headers: noStore })
    const session = sessionSnap.data() as { walkerId?: string }
    if (!isAssignedToWalker({ walkerId: session.walkerId ?? '' }, walkerUid)) {
      return NextResponse.json({ code: 'session-not-assigned' }, { status: 403, headers: noStore })
    }
  }

  try {
    const signed = createCloudinaryPrivateUploadSignature(body.folder)
    return NextResponse.json({
      cloudName: signed.cloudName,
      apiKey: signed.apiKey,
      timestamp: signed.timestamp,
      signature: signed.signature,
      publicId: signed.publicId,
      folder: signed.folder,
      type: signed.type,
      transformation: signed.transformation,
      overwrite: signed.overwrite,
      allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      maximumBytes: 10_000_000,
    }, { headers: noStore })
  } catch {
    return NextResponse.json({ code: 'signed-upload-not-configured' }, { status: 503, headers: noStore })
  }
}
