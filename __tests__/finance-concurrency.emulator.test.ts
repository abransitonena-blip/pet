/** @jest-environment node */
import { Firestore } from '@google-cloud/firestore'
const mockDb = new Firestore({ projectId: 'demo-pet-finance-concurrency' })
jest.mock('@/lib/serverAuth', () => ({ verifyAdminToken: jest.fn().mockResolvedValue('admin-test') }))
jest.mock('@/lib/finance/serverFirestore', () => ({ getPrivilegedFirestore: () => mockDb }))
jest.mock('@/lib/featureFlags', () => ({ FEATURE_FLAGS: { FINANCE_PAYMENTS_ENABLED: true } }))
import { POST as record } from '@/app/api/admin/finance/payments/route'
import { POST as confirm } from '@/app/api/admin/finance/payments/confirm/route'
import { GET as snapshot } from '@/app/api/admin/finance/tickets/[sessionId]/financial-snapshot/route'

let paymentId: string
let serviceOrderId: string
let key: string
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.match(/^(127\.0\.0\.1|localhost):\d+$/)) throw new Error('Local emulator required')
})
beforeEach(async () => {
  paymentId = mockDb.collection('payments').doc().id
  serviceOrderId = mockDb.collection('serviceOrders').doc().id
  key = `test-${paymentId}`
  await mockDb.collection('serviceOrders').doc(serviceOrderId).set({ customerId: 'customer-test' })
})
afterAll(() => mockDb.terminate())
function request(body: unknown, idempotencyKey = key) {
  return new Request('https://pet.example/api/admin/finance', {
    method: 'POST', headers: { authorization: 'Bearer test', 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(body),
  })
}
function body() {
  return { paymentId, serviceOrderId, customerId: 'customer-test', amountCents: 1000, method: { code: 'cash', kind: 'cash', displayName: 'Efectivo' } }
}

test('concurrent identical recordings replay; a changed amount conflicts without overwriting', async () => {
  const results = await Promise.all([record(request(body())), record(request(body()))])
  expect(results.map((result) => result.status)).toEqual([200, 200])
  expect((await Promise.all(results.map((result) => result.json()))).map((result) => result.replay).sort()).toEqual([false, true])
  expect((await record(request({ ...body(), amountCents: 2000 }))).status).toBe(409)
  expect((await mockDb.collection('payments').doc(paymentId).get()).data()?.result.amount.amountCents).toBe(1000)
}, 30000)

test('the same key cannot create a second payment ID', async () => {
  expect((await record(request(body()))).status).toBe(200)
  const otherId = `${paymentId}-other`
  expect((await record(request({ ...body(), paymentId: otherId }))).status).toBe(409)
  expect((await mockDb.collection('payments').doc(otherId).get()).exists).toBe(false)
})

test('an inconsistent customer/order is rejected without a payment', async () => {
  expect((await record(request({ ...body(), customerId: 'other' }))).status).toBe(400)
  expect((await mockDb.collection('payments').doc(paymentId).get()).exists).toBe(false)
})

test('confirmation concurrency replays one movement, preserving required review transition', async () => {
  await record(request(body()))
  expect((await confirm(request({ paymentId }, `confirm-${key}`))).status).toBe(400)
  await mockDb.collection('payments').doc(paymentId).update({ 'result.status': 'under_review' })
  const responses = await Promise.all([confirm(request({ paymentId }, `confirm-${key}`)), confirm(request({ paymentId }, `confirm-${key}`))])
  expect(responses.map((result) => result.status)).toEqual([200, 200])
  const payloads = await Promise.all(responses.map((result) => result.json()))
  expect(payloads[0].result.movementId).toBe(payloads[1].result.movementId)
  expect((await mockDb.collection('financialMovements').where('sourceId', '==', paymentId).get()).size).toBe(1)
}, 30000)

test('a collected payment is never treated as a fully paid session snapshot', async () => {
  await record(request(body()))
  await mockDb.collection('walkSessions').doc(paymentId).set({ orderId: serviceOrderId })
  const response = await snapshot(request({}), { params: Promise.resolve({ sessionId: paymentId }) })
  expect(response.status).toBe(200)
  const payload = await response.json()
  expect(payload.financial).toMatchObject({ reliable: false, total: null, amountPaid: null, balanceDue: null })
  expect(payload.reason).toBe('allocation-snapshot-unavailable')
})
