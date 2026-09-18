/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, serverTimestamp, setDoc, updateDoc, Timestamp, type Firestore } from 'firebase/firestore'

/**
 * La familia cancela su propio paseo desde la app, mientras nadie haya salido
 * todavía. Lo que no puede hacer: cancelar el de otra persona, cambiar la fecha
 * o el paseador con la misma escritura, ni cancelar un paseo ya en marcha.
 */

const PROJECT_ID = 'demo-pet-cancel'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

const base = {
  orderId: 'order-1', customerId: 'customer-1', dogIds: ['dog-1'], addressId: 'address-1',
  serviceId: 'paseo-individual', serviceVersion: 1, scheduledDate: '2026-10-01', scheduledStart: '10:00',
  arrivalWindowStart: '10:00', arrivalWindowEnd: '11:00', walkerId: 'walker-1', createdAt: NOW,
}

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
    for (const status of ['requested', 'assigned', 'confirmed', 'on_the_way', 'in_progress', 'completed']) {
      await setDoc(doc(db, 'walkSessions', `session-${status}`), { ...base, status })
    }
  })
})

afterAll(async () => env.cleanup())

const cancellation = (reason = 'Nos salió un imprevisto') => ({
  status: 'cancelled',
  cancelledBy: 'customer-1',
  cancelledAt: serverTimestamp(),
  cancelReason: reason,
  updatedAt: serverTimestamp(),
})

describe('la familia cancela su paseo', () => {
  test('puede mientras nadie haya salido: solicitado, asignado o confirmado', async () => {
    for (const status of ['requested', 'assigned', 'confirmed']) {
      await assertSucceeds(updateDoc(doc(dbFor('customer-1'), 'walkSessions', `session-${status}`), cancellation()))
    }
  })

  test('ya no puede cuando el paseo está en marcha o terminado', async () => {
    for (const status of ['on_the_way', 'in_progress', 'completed']) {
      await assertFails(updateDoc(doc(dbFor('customer-1'), 'walkSessions', `session-${status}`), cancellation()))
    }
  })

  test('no puede cancelar el paseo de otra familia', async () => {
    await assertFails(updateDoc(doc(dbFor('customer-2'), 'walkSessions', 'session-confirmed'), cancellation()))
  })

  test('no puede colar otro cambio en la misma escritura', async () => {
    const db = dbFor('customer-1')
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-confirmed'), { ...cancellation(), scheduledDate: '2026-12-25' }))
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-confirmed'), { ...cancellation(), walkerId: 'walker-2' }))
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-confirmed'), { ...cancellation(), serviceId: 'otro' }))
  })

  test('no puede firmar la cancelación con el nombre de alguien más, ni con una fecha inventada', async () => {
    const db = dbFor('customer-1')
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-confirmed'), { ...cancellation(), cancelledBy: 'admin-1' }))
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-confirmed'), { ...cancellation(), cancelledAt: NOW }))
  })

  test('el motivo es texto corto, y es opcional', async () => {
    const db = dbFor('customer-1')
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-confirmed'), cancellation('x'.repeat(301))))
    await assertSucceeds(updateDoc(doc(db, 'walkSessions', 'session-assigned'), {
      status: 'cancelled', cancelledBy: 'customer-1', cancelledAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
  })

  test('un paseador no cancela por la familia', async () => {
    await assertFails(updateDoc(doc(dbFor('walker-1', 'walker'), 'walkSessions', 'session-confirmed'), {
      ...cancellation(), cancelledBy: 'walker-1',
    }))
  })
})
