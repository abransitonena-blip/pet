/** @jest-environment node */
import { Firestore, Timestamp } from '@google-cloud/firestore'
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/push/pushServer', () => ({ notifyUser: jest.fn().mockResolvedValue({ sent: 0, pruned: 0 }) }))
import { dispatchRequest, respondToOffer } from '@/lib/petAhora/dispatchServer'

const db = new Firestore({ projectId: 'demo-pet-concurrency' })
const now = new Date('2026-09-14T16:00:00Z')
let requestId: string

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.match(/^(127\.0\.0\.1|localhost):\d+$/)) throw new Error('Local emulator required')
})
beforeEach(async () => {
  requestId = db.collection('petAhoraRequests').doc().id
  await db.collection('petAhoraRequests').doc(requestId).set({ clientId: 'customer-1', status: 'pending', zoneId: 'zone-1' })
  await db.collection('walkerProfiles').doc('walker-1').set({ status: 'active', name: 'Test', zones: ['zone-1'], schedule: { monday: [{ start: '00:00', end: '23:59' }] } })
})
afterAll(() => db.terminate())

async function offered() {
  const outcome = await dispatchRequest(db, requestId, 'customer-1', now)
  if (!outcome.ok) throw new Error(outcome.reason)
  return outcome
}

test('simultaneous dispatch retries produce one current offer', async () => {
  const [a, b] = await Promise.all([offered(), offered()])
  expect(a.offerId).toBe(b.offerId)
  expect((await db.collection('petAhoraOffers').where('requestId', '==', requestId).get()).size).toBe(1)
}, 30000)

test('concurrent acceptance and a retry create exactly one server-bound lease', async () => {
  const offer = await offered()
  const results = await Promise.all([1, 2].map(() => respondToOffer(db, offer.offerId, 'walker-1', true, now)))
  expect(results).toEqual([{ ok: true, status: 'accepted' }, { ok: true, status: 'accepted' }])
  expect(await respondToOffer(db, offer.offerId, 'walker-1', true, now)).toEqual({ ok: true, status: 'accepted' })
  const leases = await db.collection('petAhoraLeases').where('requestId', '==', requestId).get()
  expect(leases.size).toBe(1)
  expect(leases.docs[0].id).toBe((await db.collection('petAhoraRequests').doc(requestId).get()).data()?.leaseId)
}, 30000)

test('a previous Walker cannot poison a predictable lease ID to block the current offer', async () => {
  const offer = await offered()
  const poisoned = db.collection('petAhoraLeases').doc(requestId)
  await poisoned.set({ requestId, offerId: 'old-offer', walkerId: 'previous' })
  expect(await respondToOffer(db, offer.offerId, 'walker-1', true, now)).toEqual({ ok: true, status: 'accepted' })
  expect(await respondToOffer(db, offer.offerId, 'walker-1', true, now)).toEqual({ ok: true, status: 'accepted' })
  const saved = (await db.collection('petAhoraRequests').doc(requestId).get()).data()
  expect(saved?.leaseId).not.toBe(requestId)
  expect((await db.collection('petAhoraLeases').doc(saved!.leaseId).get()).data()?.offerId).toBe(offer.offerId)
  expect((await poisoned.get()).data()?.walkerId).toBe('previous')
})

test('a stale offer cannot overwrite a newer current offer', async () => {
  const old = await offered()
  await db.collection('petAhoraRequests').doc(requestId).update({ offerId: 'new-offer' })
  expect(await respondToOffer(db, old.offerId, 'walker-1', true, now)).toEqual({ ok: false, reason: 'offer-already-answered' })
  expect((await db.collection('petAhoraLeases').doc(requestId).get()).exists).toBe(false)
})

test.each(['suspended', 'inactive', 'invited'])('status %s denies acceptance inside the transaction', async (status) => {
  const offer = await offered()
  await db.collection('walkerProfiles').doc('walker-1').update({ status })
  expect(await respondToOffer(db, offer.offerId, 'walker-1', true, now)).toEqual({ ok: false, reason: 'offer-not-yours' })
  expect((await db.collection('petAhoraLeases').doc(requestId).get()).exists).toBe(false)
})

test.each([null, Timestamp.fromDate(now)])('missing/expired deadline cannot be accepted', async (expiresAt) => {
  const offer = await offered()
  await db.collection('petAhoraOffers').doc(offer.offerId).update({ expiresAt })
  expect(await respondToOffer(db, offer.offerId, 'walker-1', true, now)).toEqual({ ok: false, reason: 'offer-expired' })
})

test('other Walker and customer cannot claim ownership by argument', async () => {
  expect(await dispatchRequest(db, requestId, 'other', now)).toEqual({ ok: false, reason: 'request-not-dispatchable' })
  const offer = await offered()
  expect(await respondToOffer(db, offer.offerId, 'other', true, now)).toEqual({ ok: false, reason: 'offer-not-yours' })
})
