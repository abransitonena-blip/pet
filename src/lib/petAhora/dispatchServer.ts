import 'server-only'

import { Timestamp, type Firestore } from '@google-cloud/firestore'
import { businessClock, selectBestWalker } from '@/lib/dispatch'
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
async function alreadyOffered(firestore: Firestore, requestId: string): Promise<Set<string>> {
  const snapshot = await firestore.collection('petAhoraOffers').where('requestId', '==', requestId).get()
  return new Set(snapshot.docs.map((item) => String(item.data().walkerId ?? '')).filter(Boolean))
}

export async function dispatchRequest(
  firestore: Firestore,
  requestId: string,
  customerUid: string,
  now = new Date(),
): Promise<DispatchOutcome> {
  const requestRef = firestore.collection('petAhoraRequests').doc(requestId)
  const snapshot = await requestRef.get()
  if (!snapshot.exists) return { ok: false, reason: 'request-not-dispatchable' }

  const request = snapshot.data() ?? {}
  // The caller proves who they are with an ID token; the request proves it is
  // theirs. Neither is taken from the request body.
  if (request.clientId !== customerUid) return { ok: false, reason: 'request-not-dispatchable' }
  if (request.status !== 'pending' && request.status !== 'searching' && request.status !== 'offer_sent') {
    return { ok: false, reason: 'request-not-dispatchable' }
  }

  const zoneId = typeof request.zoneId === 'string' ? request.zoneId : ''
  await requestRef.update({ status: 'searching', updatedAt: Timestamp.fromDate(now) })

  const candidatesSnapshot = await firestore.collection('walkerProfiles')
    .where('status', '==', 'active')
    .limit(MAX_CANDIDATES)
    .get()

  const excluded = await alreadyOffered(firestore, requestId)
  const candidates = candidatesSnapshot.docs
    .filter((item) => !excluded.has(item.id))
    .map((item) => ({ id: item.id, ...item.data() } as Walker))

  const clock = businessClock(now)
  const best = selectBestWalker(candidates, zoneId, clock.day, clock.time)
  if (!best) {
    await requestRef.update({ status: 'expired', updatedAt: Timestamp.fromDate(now) })
    return { ok: false, reason: 'no-walkers-available' }
  }

  const offerRef = firestore.collection('petAhoraOffers').doc()
  const expiresAt = Timestamp.fromMillis(now.getTime() + OFFER_TIMEOUT_SECONDS * 1000)
  await offerRef.set({
    requestId,
    walkerId: best.walker.id,
    walkerName: best.walker.name ?? '',
    status: 'pending',
    sentAt: Timestamp.fromDate(now),
    expiresAt,
  })

  await requestRef.update({
    status: 'offer_sent',
    offerId: offerRef.id,
    offerExpiresAt: expiresAt,
    updatedAt: Timestamp.fromDate(now),
  })

  return { ok: true, offerId: offerRef.id, walkerId: best.walker.id, walkerName: best.walker.name ?? '' }
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
  const offerRef = firestore.collection('petAhoraOffers').doc(offerId)
  const offerSnapshot = await offerRef.get()
  if (!offerSnapshot.exists) return { ok: false, reason: 'offer-not-found' }

  const offer = offerSnapshot.data() ?? {}
  if (offer.walkerId !== walkerUid) return { ok: false, reason: 'offer-not-yours' }
  if (offer.status !== 'pending') return { ok: false, reason: 'offer-already-answered' }

  const expiresAt = offer.expiresAt instanceof Timestamp ? offer.expiresAt.toDate() : null
  if (expiresAt && expiresAt.getTime() < now.getTime()) {
    await offerRef.update({ status: 'expired', respondedAt: Timestamp.fromDate(now) })
    return { ok: false, reason: 'offer-expired' }
  }

  const requestId = String(offer.requestId ?? '')
  const timestamp = Timestamp.fromDate(now)

  if (!accept) {
    await offerRef.update({ status: 'declined', respondedAt: timestamp })
    // Someone said no, so look for the next candidate rather than leaving the
    // customer waiting for an offer that will never be answered.
    const requestSnapshot = await firestore.collection('petAhoraRequests').doc(requestId).get()
    const clientId = String(requestSnapshot.data()?.clientId ?? '')
    const redispatched = clientId ? await dispatchRequest(firestore, requestId, clientId, now) : undefined
    return { ok: true, status: 'declined', redispatched }
  }

  await offerRef.update({ status: 'accepted', respondedAt: timestamp })
  await firestore.collection('petAhoraRequests').doc(requestId).update({
    status: 'accepted',
    acceptedAt: timestamp,
    walkerId: walkerUid,
    walkerName: offer.walkerName ?? '',
    updatedAt: timestamp,
  })
  await firestore.collection('petAhoraLeases').doc().set({
    requestId,
    offerId,
    walkerId: walkerUid,
    status: 'active',
    lockedAt: timestamp,
  })

  return { ok: true, status: 'accepted' }
}
