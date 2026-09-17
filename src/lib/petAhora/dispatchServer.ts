import 'server-only'

import { Timestamp, type Firestore, type Transaction } from '@google-cloud/firestore'
import { businessClock, selectBestWalker } from '@/lib/dispatch'
import { notifyUser } from '@/lib/push/pushServer'
import type { Walker } from '@/types'

/**
 * Despacho de PET Ahora, del lado del servidor.
 *
 * The browser cannot do this, and that is deliberate: the Firestore rules let
 * a customer create their own request and nothing else -- they cannot move it
 * to `searching`, and they certainly cannot mint an offer addressed to a
 * walker (`petAhoraOffers` create requires `walkerId == request.auth.uid`).
 * The original hook tried all three from the customer's browser, so every
 * request would have been created and then silently stranded until it expired.
 *
 * Matching a request to a walker is an operational decision the customer must
 * not be able to forge, so it belongs here, behind the privileged Firestore
 * client that bypasses rules. The scoring itself is the same `selectBestWalker`
 * the admin panel uses -- there is one definition of "best walker", not two.
 */

const OFFER_TIMEOUT_SECONDS = 30
const MAX_CANDIDATES = 50

export type DispatchOutcome =
  | { readonly ok: true; readonly offerId: string; readonly walkerId: string; readonly walkerName: string }
  | { readonly ok: false; readonly reason: 'no-walkers-available' | 'request-not-dispatchable' }

/**
 * Walkers already offered this request, so a retry moves on to the next
 * candidate instead of pestering the same person again.
 */
async function alreadyOffered(firestore: Firestore, transaction: Transaction, requestId: string): Promise<Set<string>> {
  const snapshot = await transaction.get(firestore.collection('petAhoraOffers').where('requestId', '==', requestId).limit(MAX_CANDIDATES + 1))
  if (snapshot.size > MAX_CANDIDATES) throw new Error('dispatch-attempt-limit')
  return new Set(snapshot.docs.map((item) => String(item.data().walkerId ?? '')).filter(Boolean))
}

export async function dispatchRequest(
  firestore: Firestore,
  requestId: string,
  customerUid: string,
  now = new Date(),
): Promise<DispatchOutcome> {
  if (!requestId || requestId.includes('/')) return { ok: false, reason: 'request-not-dispatchable' }
  const requestRef = firestore.collection('petAhoraRequests').doc(requestId)
  const outcome = await firestore.runTransaction<DispatchOutcome & { created?: boolean }>(async (transaction) => {
  const snapshot = await transaction.get(requestRef)
  if (!snapshot.exists) return { ok: false, reason: 'request-not-dispatchable' }

  const request = snapshot.data() ?? {}
  // The caller proves who they are with an ID token; the request proves it is
  // theirs. Neither is taken from the request body.
  if (request.clientId !== customerUid) return { ok: false, reason: 'request-not-dispatchable' }
  if (request.status !== 'pending' && request.status !== 'searching' && request.status !== 'offer_sent') {
    return { ok: false, reason: 'request-not-dispatchable' }
  }

  // Concurrent retries reuse a live offer; an older offer cannot replace it.
  if (typeof request.offerId === 'string' && request.offerId && !request.offerId.includes('/')) {
    const current = (await transaction.get(firestore.collection('petAhoraOffers').doc(request.offerId))).data()
    if (current?.status === 'pending' && current.requestId === requestId
      && current.expiresAt instanceof Timestamp && current.expiresAt.toMillis() > now.getTime()) {
      return { ok: true, offerId: request.offerId, walkerId: current.walkerId, walkerName: current.walkerName ?? '' }
    }
  }

  const zoneId = typeof request.zoneId === 'string' ? request.zoneId : ''

  const candidatesSnapshot = await transaction.get(firestore.collection('walkerProfiles')
    .where('status', '==', 'active')
    .limit(MAX_CANDIDATES))

  const excluded = await alreadyOffered(firestore, transaction, requestId)
  const candidates = candidatesSnapshot.docs
    .filter((item) => !excluded.has(item.id))
    .map((item) => ({ ...item.data(), id: item.id } as Walker))

  const clock = businessClock(now)
  const best = selectBestWalker(candidates, zoneId, clock.day, clock.time)
  if (!best) {
    transaction.update(requestRef, { status: 'expired', updatedAt: Timestamp.fromDate(now) })
    return { ok: false, reason: 'no-walkers-available' }
  }

  const offerRef = firestore.collection('petAhoraOffers').doc()
  const expiresAt = Timestamp.fromMillis(now.getTime() + OFFER_TIMEOUT_SECONDS * 1000)
  transaction.create(offerRef, {
    requestId,
    walkerId: best.walker.id,
    walkerName: best.walker.name ?? '',
    status: 'pending',
    sentAt: Timestamp.fromDate(now),
    expiresAt,
  })

  transaction.update(requestRef, {
    status: 'offer_sent',
    offerId: offerRef.id,
    offerExpiresAt: expiresAt,
    updatedAt: Timestamp.fromDate(now),
  })
  return { ok: true, offerId: offerRef.id, walkerId: best.walker.id, walkerName: best.walker.name ?? '', created: true }
  })
  if (!outcome.ok) return outcome

  // The walker has OFFER_TIMEOUT_SECONDS to answer; without a push they only
  // see the offer if their panel happens to be open. A failed push must never
  // undo a dispatch that already happened. No-op while FCM_ENABLED is off.
  if (outcome.created) await notifyUser(firestore, outcome.walkerId, {
    title: 'Nueva solicitud PET Ahora',
    body: `Tienes ${OFFER_TIMEOUT_SECONDS} segundos para aceptarla.`,
    url: '/walker',
    tag: `pet-ahora-${requestId}`,
  }).catch(() => undefined)

  return { ok: true, offerId: outcome.offerId, walkerId: outcome.walkerId, walkerName: outcome.walkerName }
}

export type RespondOutcome =
  | { readonly ok: true; readonly status: 'accepted' | 'declined'; readonly redispatched?: DispatchOutcome }
  | { readonly ok: false; readonly reason: 'offer-not-found' | 'offer-not-yours' | 'offer-already-answered' | 'offer-expired' }

export async function respondToOffer(
  firestore: Firestore,
  offerId: string,
  walkerUid: string,
  accept: boolean,
  now = new Date(),
): Promise<RespondOutcome> {
  if (!offerId || offerId.includes('/')) return { ok: false, reason: 'offer-not-found' }
  const offerRef = firestore.collection('petAhoraOffers').doc(offerId)
  const startedAt = Date.now()
  const result = await firestore.runTransaction<RespondOutcome & { requestId?: string; clientId?: string }>(async (transaction) => {
  const offerSnapshot = await transaction.get(offerRef)
  if (!offerSnapshot.exists) return { ok: false, reason: 'offer-not-found' }

  const offer = offerSnapshot.data() ?? {}
  if (offer.walkerId !== walkerUid) return { ok: false, reason: 'offer-not-yours' }
  const profile = await transaction.get(firestore.collection('walkerProfiles').doc(walkerUid))
  if (!profile.exists || profile.data()?.status !== 'active') return { ok: false, reason: 'offer-not-yours' }
  const requestId = typeof offer.requestId === 'string' ? offer.requestId : ''
  if (!requestId || requestId.includes('/')) return { ok: false, reason: 'offer-not-found' }
  const requestRef = firestore.collection('petAhoraRequests').doc(requestId)
  const requestSnapshot = await transaction.get(requestRef)
  const request = requestSnapshot.data()
  if (!request || request.offerId !== offerId) return { ok: false, reason: 'offer-already-answered' }
  if (accept && offer.status === 'accepted' && request.status === 'accepted' && request.walkerId === walkerUid) {
    const leaseId = typeof request.leaseId === 'string' ? request.leaseId : ''
    if (!leaseId || leaseId.includes('/')) return { ok: false, reason: 'offer-already-answered' }
    const lease = await transaction.get(firestore.collection('petAhoraLeases').doc(leaseId))
    if (lease.data()?.requestId === requestId && lease.data()?.offerId === offerId
      && lease.data()?.walkerId === walkerUid) return { ok: true, status: 'accepted' }
    return { ok: false, reason: 'offer-already-answered' }
  }
  if (offer.status !== 'pending' || request.status !== 'offer_sent') return { ok: false, reason: 'offer-already-answered' }

  const expiresAt = offer.expiresAt instanceof Timestamp ? offer.expiresAt.toDate() : null
  if (!expiresAt || expiresAt.getTime() <= now.getTime() + Date.now() - startedAt) {
    transaction.update(offerRef, { status: 'expired', respondedAt: Timestamp.fromDate(now) })
    return { ok: false, reason: 'offer-expired' }
  }

  const timestamp = Timestamp.fromDate(now)

  if (!accept) {
    transaction.update(offerRef, { status: 'declined', respondedAt: timestamp })
    transaction.update(requestRef, { status: 'searching', updatedAt: timestamp })
    // Someone said no, so look for the next candidate rather than leaving the
    // customer waiting for an offer that will never be answered.
    return { ok: true, status: 'declined', requestId, clientId: String(request.clientId ?? '') }
  }

  // Legacy rules allow client-created leases. Never use a predictable lease
  // document as authority: bind a fresh server ID atomically to this request.
  const leaseRef = firestore.collection('petAhoraLeases').doc()
  transaction.update(offerRef, { status: 'accepted', respondedAt: timestamp })
  transaction.update(requestRef, {
    status: 'accepted',
    acceptedAt: timestamp,
    walkerId: walkerUid,
    walkerName: offer.walkerName ?? '',
    leaseId: leaseRef.id,
    updatedAt: timestamp,
  })
  transaction.create(leaseRef, {
    requestId,
    offerId,
    walkerId: walkerUid,
    status: 'active',
    lockedAt: timestamp,
  })

  return { ok: true, status: 'accepted' }
  })
  if (result.ok && result.status === 'declined') {
    const redispatched = result.requestId && result.clientId
      ? await dispatchRequest(firestore, result.requestId, result.clientId, now) : undefined
    return { ok: true, status: 'declined', redispatched }
  }
  return result
}
