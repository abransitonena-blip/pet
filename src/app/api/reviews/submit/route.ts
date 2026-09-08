import { NextResponse } from 'next/server'
import { verifyAuthenticatedToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const MAX_TEXT_LENGTH = 500
const MAX_NAME_LENGTH = 120

/**
 * Closes DR-09: the reviews collection previously accepted a create from any
 * authenticated customer (firestore.rules only checked shape, not history),
 * so anyone could post a review without ever completing a paid walk. This
 * endpoint checks the canonical walkSessions collection (never legacy
 * reservations) for at least one status=='completed' session belonging to
 * the caller, via the T3 privileged Firestore client -- a real server-side
 * eligibility check the client cannot forge. The review write itself also
 * happens here, not from the browser.
 *
 * Fails closed behind PUBLIC_REVIEWS_ENABLED (stays false) and behind T3
 * identity availability. Firestore rules for `reviews` still need tightening
 * to `allow create: if false` before this is the only path -- see
 * artifacts/rules/reviews-server-only.fragment.rules (not deployed).
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const uid = await verifyAuthenticatedToken(token)
  if (!uid) return NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })

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
    const completedSessions = await firestore
      .collection('walkSessions')
      .where('customerId', '==', uid)
      .where('status', '==', 'completed')
      .limit(1)
      .get()

    if (completedSessions.empty) {
      return NextResponse.json({ code: 'not-eligible', reason: 'no-completed-walk' }, { status: 403, headers: noStore })
    }

    const reviewRef = firestore.collection('reviews').doc()
    await reviewRef.set({
      name,
      petName: petName || null,
      rating,
      text,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      customerId: uid,
      verifiedEligible: true,
    })

    return NextResponse.json({ code: 'ok', reviewId: reviewRef.id }, { headers: noStore })
  } catch {
    return NextResponse.json({ code: 'submit-failed' }, { status: 500, headers: noStore })
  }
}
