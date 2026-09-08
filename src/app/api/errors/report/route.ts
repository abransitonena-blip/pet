import { NextResponse } from 'next/server'
import { verifyAuthenticatedToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const MAX_MESSAGE_LENGTH = 500
const MAX_STACK_LENGTH = 2000
const MAX_CONTEXT_LENGTH = 200
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * Records a client-side crash so an Admin can actually see it happened,
 * instead of it only existing in a browser console nobody looks at. Requires
 * authentication (skips pre-login errors on public pages, a deliberate scope
 * limit, not a gap) so this can't become an anonymous write-spam vector.
 * Fails closed behind T3 identity availability, same as reviews/submit.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const uid = await verifyAuthenticatedToken(token)
  if (!uid) return NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })

  const rateLimit = checkRateLimit(`errors-report:${uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { message?: unknown; stack?: unknown; context?: unknown; url?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : ''
  if (!message) return NextResponse.json({ code: 'missing-message' }, { status: 400, headers: noStore })
  const stack = typeof body.stack === 'string' ? body.stack.slice(0, MAX_STACK_LENGTH) : null
  const context = typeof body.context === 'string' ? body.context.trim().slice(0, MAX_CONTEXT_LENGTH) : null
  const url = typeof body.url === 'string' ? body.url.trim().slice(0, MAX_CONTEXT_LENGTH) : null

  try {
    const logRef = firestore.collection('errorLogs').doc()
    await logRef.set({
      message,
      stack,
      context,
      url,
      uid,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ code: 'ok' }, { headers: noStore })
  } catch {
    return NextResponse.json({ code: 'report-failed' }, { status: 500, headers: noStore })
  }
}
