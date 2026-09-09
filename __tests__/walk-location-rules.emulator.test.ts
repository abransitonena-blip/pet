/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'

/**
 * Ubicación de inicio y fin del paseo.
 *
 * Only the two transitions that bracket the walk may carry a point, the shape
 * is validated, and the field stays optional so a walker without GPS (or who
 * denied the permission) can still finish their walk.
 */

const PROJECT_ID = 'demo-pet-walk-location'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

const validPoint = { lat: 19.4326, lng: -99.1332, accuracy: 12, capturedAt: NOW }

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active' })
    const base = {
      orderId: 'order-1', customerId: 'customer-1', dogIds: ['dog-1'],
      addressId: 'address-1', serviceId: 'paseo-individual', serviceVersion: 1,
      scheduledDate: '2026-08-24', scheduledStart: '10:00',
      arrivalWindowStart: '10:00', arrivalWindowEnd: '11:00',
      walkerId: 'walker-1', createdAt: NOW,
    }
    await setDoc(doc(db, 'walkSessions', 'session-arrived'), { ...base, status: 'arrived' })
    await setDoc(doc(db, 'walkSessions', 'session-running'), { ...base, status: 'in_progress' })
    await setDoc(doc(db, 'walkSessions', 'session-confirmed'), { ...base, status: 'confirmed' })
  })
}

beforeAll(async () => {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST?.split(':')
  const rulesPath = process.env.FIRESTORE_RULES_PATH ?? process.env.WALK_REPORT_RULES_PATH
  if (!hostPort?.[0] || !hostPort[1] || !rulesPath) throw new Error('FIRESTORE_EMULATOR_HOST and FIRESTORE_RULES_PATH are required')
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: hostPort[0], port: Number(hostPort[1]), rules: readFileSync(rulesPath, 'utf8') },
  })
})

beforeEach(async () => { await env.clearFirestore(); await seed() })
afterAll(async () => env.cleanup())

describe('ubicación de inicio y fin del paseo', () => {
  test('el paseador asignado registra el punto de inicio al empezar', async () => {
    const db = dbFor('walker-1', 'walker')
    await assertSucceeds(updateDoc(doc(db, 'walkSessions', 'session-arrived'), {
      status: 'in_progress',
      startedAt: serverTimestamp(),
      startLocation: validPoint,
      updatedAt: serverTimestamp(),
    }))
  })

  test('el punto de fin se registra al completar', async () => {
    const db = dbFor('walker-1', 'walker')
    await assertSucceeds(updateDoc(doc(db, 'walkSessions', 'session-running'), {
      status: 'completed',
      completedAt: serverTimestamp(),
      endLocation: validPoint,
      updatedAt: serverTimestamp(),
    }))
  })

  test('sin GPS el paseo avanza igual: la ubicación es opcional', async () => {
    const db = dbFor('walker-1', 'walker')
    await assertSucceeds(updateDoc(doc(db, 'walkSessions', 'session-arrived'), {
      status: 'in_progress',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
  })

  test('coordenadas fuera de rango se rechazan', async () => {
    const db = dbFor('walker-1', 'walker')
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-arrived'), {
      status: 'in_progress',
      startedAt: serverTimestamp(),
      startLocation: { ...validPoint, lat: 120 },
      updatedAt: serverTimestamp(),
    }))
  })

  test('un punto sin los campos exactos se rechaza', async () => {
    const db = dbFor('walker-1', 'walker')
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-arrived'), {
      status: 'in_progress',
      startedAt: serverTimestamp(),
      startLocation: { lat: 19.4326, lng: -99.1332 },
      updatedAt: serverTimestamp(),
    }))
  })

  test('una transición que no abre ni cierra el paseo no puede llevar ubicación', async () => {
    const db = dbFor('walker-1', 'walker')
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-confirmed'), {
      status: 'on_the_way',
      onTheWayAt: serverTimestamp(),
      startLocation: validPoint,
      updatedAt: serverTimestamp(),
    }))
  })

  test('otro paseador no puede escribir la ubicación de una sesión ajena', async () => {
    const db = dbFor('walker-2', 'walker')
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-arrived'), {
      status: 'in_progress',
      startedAt: serverTimestamp(),
      startLocation: validPoint,
      updatedAt: serverTimestamp(),
    }))
  })

  test('el cliente no puede inventar la ubicación de su propio paseo', async () => {
    const db = dbFor('customer-1', 'customer')
    await assertFails(updateDoc(doc(db, 'walkSessions', 'session-arrived'), {
      status: 'in_progress',
      startedAt: serverTimestamp(),
      startLocation: validPoint,
      updatedAt: serverTimestamp(),
    }))
  })
})
