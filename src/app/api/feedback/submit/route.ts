import { NextResponse } from 'next/server'
import { verifyAuthenticatedToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const MAX_MESSAGE_LENGTH = 800
const CATEGORIES = new Set(['sugerencia', 'queja', 'elogio', 'otro'])
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * Private feedback channel: no eligibility check (unlike reviews/submit),
 * never published anywhere, Admin-only read. Deliberately not a review.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const uid = await verifyAuthenticatedToken(token)
  if (!uid) return NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })

  const rateLimit = checkRateLimit(`feedback-submit:${uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { message?: unknown; category?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : ''
  if (!message) return NextResponse.json({ code: 'missing-message' }, { status: 400, headers: noStore })
  const category = typeof body.category === 'string' && CATEGORIES.has(body.category) ? body.category : 'otro'

  try {
    const docRef = firestore.collection('feedback').doc()
    await docRef.set({
      message,
      category,
      customerId: uid,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ code: 'ok' }, { headers: noStore })
  } catch {
    return NextResponse.json({ code: 'submit-failed' }, { status: 500, headers: noStore })
  }
}
