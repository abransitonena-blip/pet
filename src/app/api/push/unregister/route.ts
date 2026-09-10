import { NextResponse } from 'next/server'
import { verifyAuthenticatedToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { isPlausibleToken } from '@/lib/push/pushTokens'
import { removeDeviceTokens } from '@/lib/push/pushServer'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * Deja de avisar a este dispositivo. Only ever removes a token from the
 * caller's own list -- the uid comes from the verified ID token.
 * Fails closed behind FCM_ENABLED.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const uid = await verifyAuthenticatedToken(idToken)
  if (!uid) return NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })

  if (!FEATURE_FLAGS.FCM_ENABLED) {
    return NextResponse.json({ code: 'push-not-enabled' }, { status: 503, headers: noStore })
  }

  const rateLimit = checkRateLimit(`push-unregister:${uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
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
  if (!isPlausibleToken(body.token)) {
    return NextResponse.json({ code: 'invalid-device-token' }, { status: 400, headers: noStore })
  }

  try {
    await removeDeviceTokens(firestore, uid, new Set([body.token]))
    return NextResponse.json({ code: 'ok' }, { headers: noStore })
  } catch (error) {
    console.error('push/unregister failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'unregister-failed' }, { status: 500, headers: noStore })
  }
}
