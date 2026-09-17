import { NextResponse } from 'next/server'
import { verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { createCloudinaryPrivateUploadSignature } from '@/lib/media/privateMediaAdmin.server'
import { isAssignedToWalker } from '@/lib/walkerPanel'
import { DOG_PHOTO_FOLDER } from '@/lib/dogPhotos'
import { WALKER_PHOTO_FOLDER } from '@/lib/walkerPhotos'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
// Walk-report photos and the photo of a family's own dog are the operational
// photos switched on (owner decision, 2026-09-10 and 2026-09-11; see
// MEDIA_POLICY.md). PET Ahora and incident photos stay off until they get the
// same review.
const WALK_REPORT_FOLDER = 'pet-ap-private/walk-reports'
const ALLOWED_FOLDERS = new Set([WALK_REPORT_FOLDER, DOG_PHOTO_FOLDER, WALKER_PHOTO_FOLDER])

/**
 * M1 signed upload for operational (private) photos. Unlike the public
 * gallery signature, this always signs an `authenticated` delivery-type
 * asset -- the URL alone never grants access.
 *
 * Cada carpeta tiene su dueño, y el servidor lo comprueba contra Firestore, no
 * contra lo que diga el cuerpo de la petición: las fotos de un reporte las sube
 * el paseador de esa sesión (o el equipo), y la foto de un perro la sube la
 * familia dueña de ese perro. Fail-closed behind PRIVATE_MEDIA_UPLOADS_ENABLED.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })

  const caller = await verifyTokenRole(token)
  if (!caller) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = caller.role === 'admin' ? caller.uid : null
  const walkerUid = caller.role === 'walker' ? caller.uid : null
  const callerUid = caller.uid

  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) {
    return NextResponse.json({ code: 'private-media-uploads-not-enabled' }, { status: 503, headers: noStore })
  }

  let body: { folder?: unknown; sessionId?: unknown; dogId?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  if (typeof body.folder !== 'string' || !ALLOWED_FOLDERS.has(body.folder)) {
    return NextResponse.json({ code: 'invalid-folder' }, { status: 400, headers: noStore })
  }

  if (body.folder === WALK_REPORT_FOLDER && !adminUid && !walkerUid) {
    return NextResponse.json({ code: 'admin-or-walker-required' }, { status: 403, headers: noStore })
  }

  if (body.folder === WALK_REPORT_FOLDER && walkerUid) {
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

  // La foto de un perro: sólo su familia (o el equipo). El dueño se lee del
  // documento del perro, nunca del cuerpo de la petición.
  if (body.folder === DOG_PHOTO_FOLDER && !adminUid) {
    const dogId = typeof body.dogId === 'string' ? body.dogId.trim() : ''
    if (!dogId || dogId.includes('/')) {
      return NextResponse.json({ code: 'dog-id-required' }, { status: 400, headers: noStore })
    }
    const firestore = getPrivilegedFirestore()
    if (!firestore) return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
    const dogSnap = await firestore.collection('dogs').doc(dogId).get()
    if (!dogSnap.exists) return NextResponse.json({ code: 'dog-not-found' }, { status: 404, headers: noStore })
    if ((dogSnap.data() as { ownerId?: string }).ownerId !== callerUid) {
      return NextResponse.json({ code: 'dog-not-yours' }, { status: 403, headers: noStore })
    }
  }

  // La foto de un paseador la sube ese paseador, y nadie más: no hace falta id
  // porque el único perfil que puede tocar es el suyo.
  if (body.folder === WALKER_PHOTO_FOLDER && !adminUid && !walkerUid) {
    return NextResponse.json({ code: 'walker-required' }, { status: 403, headers: noStore })
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
