/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, serverTimestamp, setDoc, updateDoc, Timestamp, type Firestore } from 'firebase/firestore'

/**
 * La familia mueve su paseo a otro día. Mover suelta al paseador -- puede no
 * estar libre a la hora nueva --, así que el paseo vuelve a la cola.
 */

const PROJECT_ID = 'demo-pet-reschedule'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

const base = {
  orderId: 'order-1', customerId: 'customer-1', dogIds: ['dog-1'], addressId: 'address-1',
  serviceId: 'paseo-individual', serviceVersion: 1, scheduledDate: '2026-10-01', scheduledStart: '10:00',
  arrivalWindowStart: '10:00', arrivalWindowEnd: '10:20', walkerId: 'walker-1', createdAt: NOW,
}

const move = (over: Record<string, unknown> = {}) => ({
  scheduledDate: '2026-10-08',
  scheduledStart: '12:00',
  arrivalWindowStart: '12:00',
  arrivalWindowEnd: '12:20',
  status: 'requested',
  walkerId: '',
  rescheduledBy: 'customer-1',
  rescheduledAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...over,
})

beforeAll(async () => {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST?.split(':')
  const rulesPath = process.env.FIRESTORE_RULES_PATH
  if (!hostPort?.[0] || !hostPort[1] || !rulesPath) throw new Error('FIRESTORE_EMULATOR_HOST and FIRESTORE_RULES_PATH are required')
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: hostPort[0], port: Number(hostPort[1]), rules: readFileSync(rulesPath, 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active' })
    for (const status of ['requested', 'assigned', 'confirmed', 'on_the_way', 'in_progress', 'completed', 'cancelled']) {
      await setDoc(doc(db, 'walkSessions', `session-${status}`), { ...base, status })
    }
  })
})

afterAll(async () => env.cleanup())

describe('la familia mueve su paseo', () => {
  test('puede mientras nadie haya salido, y el paseo vuelve a la cola sin paseador', async () => {
    for (const status of ['requested', 'assigned', 'confirmed']) {
      await assertSucceeds(updateDoc(doc(dbFor('customer-1'), 'walkSessions', `session-${status}`), move()))
    }
  })

  test('ya no puede cuando el paseo empezó, terminó o se canceló', async () => {
    for (const status of ['on_the_way', 'in_progress', 'completed', 'cancelled']) {
      await assertFails(updateDoc(doc(dbFor('customer-1'), 'walkSessions', `session-${status}`), move()))
    }
  })

  test('no puede quedarse con el paseador al mover la fecha', async () => {
    await assertFails(updateDoc(doc(dbFor('customer-1'), 'walkSessions', 'session-confirmed'), move({ walkerId: 'walker-1' })))
    await assertFails(updateDoc(doc(dbFor('customer-1'), 'walkSessions', 'session-confirmed'), move({ status: 'confirmed' })))
  })

  test('la fecha y la hora tienen que tener forma de fecha y de hora', async () => {
    const db = dbFor('customer-1')
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-requested'), move({ scheduledDate: 'mañana' })))
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-requested'), move({ scheduledStart: '25:99' })))
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-requested'), move({ arrivalWindowEnd: '' })))
  })

  test('mover sin mover no es mover', async () => {
    await assertFails(updateDoc(doc(dbFor('customer-1'), 'walkSessions', 'session-requested'), move({
      scheduledDate: base.scheduledDate, scheduledStart: base.scheduledStart,
    })))
  })

  test('no puede mover el paseo de otra familia, ni colar otro cambio', async () => {
    await assertFails(updateDoc(doc(dbFor('customer-2'), 'walkSessions', 'session-confirmed'), move({ rescheduledBy: 'customer-2' })))
    await assertFails(updateDoc(doc(dbFor('customer-1'), 'walkSessions', 'session-confirmed'), move({ serviceId: 'otro' })))
    await assertFails(updateDoc(doc(dbFor('customer-1'), 'walkSessions', 'session-confirmed'), move({ dogIds: ['dog-2'] })))
  })

  test('la firma es suya y del reloj del servidor', async () => {
    const db = dbFor('customer-1')
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-confirmed'), move({ rescheduledBy: 'admin-1' })))
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-confirmed'), move({ rescheduledAt: NOW })))
  })

  test('un paseador no mueve el paseo por la familia', async () => {
    await assertFails(updateDoc(doc(dbFor('walker-1', 'walker'), 'walkSessions', 'session-confirmed'), move({ rescheduledBy: 'walker-1' })))
  })
})
