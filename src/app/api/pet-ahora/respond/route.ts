import { NextResponse } from 'next/server'
import { verifyWalkerToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { respondToOffer } from '@/lib/petAhora/dispatchServer'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

/**
 * El paseador acepta o rechaza una oferta de PET Ahora.
 *
 * Accepting has to write three documents that no browser may write together:
 * the offer, the request (including the walkerId that decides who the walk
 * belongs to) and the lease. Declining also triggers the search for the next
 * candidate, so the customer is not left waiting on an offer nobody will
 * answer. Ownership of the offer is checked against the stored document.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const walkerUid = await verifyWalkerToken(token)
  if (!walkerUid) return NextResponse.json({ code: 'walker-required' }, { status: 403, headers: noStore })

  if (!FEATURE_FLAGS.PET_AHORA_ENABLED) {
    return NextResponse.json({ code: 'pet-ahora-not-enabled' }, { status: 503, headers: noStore })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { offerId?: unknown; accept?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  if (typeof body.offerId !== 'string' || !body.offerId.trim() || typeof body.accept !== 'boolean') {
    return NextResponse.json({ code: 'invalid-response' }, { status: 400, headers: noStore })
  }

  try {
    const outcome = await respondToOffer(firestore, body.offerId.trim(), walkerUid, body.accept)
    if (!outcome.ok) {
      return NextResponse.json({ code: outcome.reason }, {
        status: outcome.reason === 'offer-not-found' ? 404 : 409,
        headers: noStore,
      })
    }
    return NextResponse.json({ code: 'ok', status: outcome.status }, { headers: noStore })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('pet-ahora/respond failed:', detail)
    return NextResponse.json({ code: 'respond-failed' }, { status: 500, headers: noStore })
  }
}
