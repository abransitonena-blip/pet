import { NextResponse } from 'next/server'
import { Timestamp } from '@google-cloud/firestore'
import { verifyAuthenticatedToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { isShareToken } from '@/lib/locationShare'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * Apagar un enlace de ubicación antes de que caduque solo.
 *
 * Sólo quien lo creó -- comparado contra el documento guardado, nunca contra
 * lo que manda el cliente. Revocar es para siempre: no hay "reactivar", igual
 * que una alerta de geocerca no se puede des-avisar.
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

  const rateLimit = checkRateLimit(`share-revoke:${uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { token?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  if (!isShareToken(body.token)) {
    return NextResponse.json({ code: 'invalid-token' }, { status: 400, headers: noStore })
  }

  try {
    const shareRef = firestore.collection('walkShareLinks').doc(body.token)
    const shareSnapshot = await shareRef.get()
    const share = shareSnapshot.exists ? shareSnapshot.data() ?? {} : null
    if (!share || share.customerId !== uid) {
      return NextResponse.json({ code: 'share-not-yours' }, { status: 403, headers: noStore })
    }
    if (share.revokedAt) {
      return NextResponse.json({ code: 'ok', alreadyRevoked: true }, { headers: noStore })
    }

    await shareRef.update({ revokedAt: Timestamp.now() })
    return NextResponse.json({ code: 'ok' }, { headers: noStore })
  } catch (error) {
    console.error('tracking/share/revoke failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'share-revoke-failed' }, { status: 500, headers: noStore })
  }
}
