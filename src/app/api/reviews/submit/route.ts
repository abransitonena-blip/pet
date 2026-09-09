import { NextResponse } from 'next/server'
import { verifyAuthenticatedToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const MAX_TEXT_LENGTH = 500
const MAX_NAME_LENGTH = 120
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * By explicit product decision, reviews do not require a verified completed
 * walk (DR-09's eligibility check was intentionally removed) -- any
 * authenticated Familia PET account can post one, kept honest only by
 * requiring login and by the rate limit below. The write still happens
 * server-side, never from the browser, so the client can't forge fields
 * like customerId.
 *
 * Fails closed behind PUBLIC_REVIEWS_ENABLED (stays false) and behind T3
 * identity availability.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const uid = await verifyAuthenticatedToken(token)
  if (!uid) return NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })

  const rateLimit = checkRateLimit(`reviews-submit:${uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  if (!FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED) {
    return NextResponse.json({ code: 'reviews-not-enabled' }, { status: 503, headers: noStore })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { name?: unknown; petName?: unknown; rating?: unknown; text?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ code: 'invalid-rating' }, { status: 400, headers: noStore })
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME_LENGTH) : ''
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT_LENGTH) : ''
  const petName = typeof body.petName === 'string' ? body.petName.trim().slice(0, MAX_NAME_LENGTH) : ''
  if (!name || !text) {
    return NextResponse.json({ code: 'missing-fields' }, { status: 400, headers: noStore })
  }

  try {
    const reviewRef = firestore.collection('reviews').doc()
    await reviewRef.set({
      name,
      petName: petName || null,
      rating,
      text,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      customerId: uid,
    })

    return NextResponse.json({ code: 'ok', reviewId: reviewRef.id }, { headers: noStore })
  } catch {
    return NextResponse.json({ code: 'submit-failed' }, { status: 500, headers: noStore })
  }
}
