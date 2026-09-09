import { NextResponse } from 'next/server'
import { verifyAuthenticatedToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { dispatchRequest } from '@/lib/petAhora/dispatchServer'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * Busca un paseador para una solicitud de PET Ahora.
 *
 * The customer's browser creates the request (the rules allow exactly that)
 * and then calls here. Matching is a decision the customer must not be able to
 * forge, so it runs server-side against the privileged Firestore -- see
 * dispatchServer.ts. Ownership is checked against the stored request, never
 * trusted from the body.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const uid = await verifyAuthenticatedToken(token)
  if (!uid) return NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })

  if (!FEATURE_FLAGS.PET_AHORA_ENABLED) {
    return NextResponse.json({ code: 'pet-ahora-not-enabled' }, { status: 503, headers: noStore })
  }

  const rateLimit = checkRateLimit(`pet-ahora-dispatch:${uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { requestId?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  if (typeof body.requestId !== 'string' || !body.requestId.trim()) {
    return NextResponse.json({ code: 'invalid-request-id' }, { status: 400, headers: noStore })
  }

  try {
    const outcome = await dispatchRequest(firestore, body.requestId.trim(), uid)
    if (!outcome.ok) {
      return NextResponse.json({ code: outcome.reason }, {
        status: outcome.reason === 'no-walkers-available' ? 409 : 404,
        headers: noStore,
      })
    }
    return NextResponse.json({ code: 'ok', ...outcome }, { headers: noStore })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('pet-ahora/dispatch failed:', detail)
    return NextResponse.json({ code: 'dispatch-failed' }, { status: 500, headers: noStore })
  }
}
