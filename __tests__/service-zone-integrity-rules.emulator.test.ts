/** @jest-environment node */

import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

const PROJECT_ID = 'demo-pet-zone-integrity'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
const RULES_PATH = process.env.FIRESTORE_RULES_PATH || 'firestore.rules'
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

async function seed(callback: (db: Firestore) => Promise<void>): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => callback(context.firestore() as unknown as Firestore))
}

const publicService = {
  id: 'paseo-individual',
  name: 'Paseo Individual',
  duration: '30 min',
  amountCents: 3000,
  currency: 'MXN',
  active: true,
  complimentary: false,
  version: 3,
}

const order = {
  customerId: 'customer-1',
  dogIds: ['dog-1'],
  serviceId: 'paseo-individual',
  serviceName: 'Paseo Individual',
  packageType: 'individual',
  numberOfSessions: 1,
  addressId: 'address-1',
  notes: '',
  status: 'pending_confirmation',
  paymentStatus: 'pending',
  requestedSchedule: [{ date: '2026-08-30', time: '10:00-11:00' }],
  serviceVersion: 3,
  createdAt: NOW,
}

const requestedSession = {
  orderId: 'order-1',
  customerId: 'customer-1',
  dogIds: ['dog-1'],
  addressId: 'address-1',
  serviceId: 'paseo-individual',
  scheduledDate: '2026-08-30',
  scheduledStart: '10:00',
  arrivalWindowStart: '10:00',
  arrivalWindowEnd: '11:00',
  notes: '',
  status: 'requested',
  serviceVersion: 3,
  createdAt: NOW,
}

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '').split(':')
  if (!host || !port) throw new Error('FIRESTORE_EMULATOR_HOST is required')
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host, port: Number(port), rules: readFileSync(RULES_PATH, 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed(async (db) => {
    await setDoc(doc(db, 'zones', 'zone-1'), { name: 'La Quebrada', active: true })
    await setDoc(doc(db, 'zones', 'zone-off'), { name: 'Sin cobertura', active: false })
    await setDoc(doc(db, 'dogs', 'dog-1'), { ownerId: 'customer-1', name: 'Perro' })
    await setDoc(doc(db, 'dogs', 'dog-2'), { ownerId: 'customer-2', name: 'Ajeno' })
    await setDoc(doc(db, 'addresses', 'address-1'), { ownerId: 'customer-1', zoneId: 'zone-1' })
    await setDoc(doc(db, 'addresses', 'address-2'), { ownerId: 'customer-2', zoneId: 'zone-1' })
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active' })
    await setDoc(doc(db, 'appSettings', 'servicePrices'), { services: { 'paseo-individual': publicService } })
  })
})

afterAll(async () => env.cleanup())

test('customer creates one coherent order and requested session atomically', async () => {
  const customer = dbFor('customer-1')
  const batch = writeBatch(customer)
  batch.set(doc(customer, 'serviceOrders', 'order-1'), order)
  batch.set(doc(customer, 'walkSessions', 'session-1'), requestedSession)
  await assertSucceeds(batch.commit())
})

test('address requires ownership and an existing active zone', async () => {
  const customer = dbFor('customer-1')
  await assertSucceeds(setDoc(doc(customer, 'addresses', 'valid'), {
    ownerId: 'customer-1', zoneId: 'zone-1', street: 'Calle', city: 'Ciudad', alias: 'Casa', createdAt: NOW,
  }))
  await assertFails(setDoc(doc(customer, 'addresses', 'unknown-zone'), {
    ownerId: 'customer-1', zoneId: 'unknown', street: 'Calle', city: 'Ciudad', alias: 'Casa', createdAt: NOW,
  }))
  await assertFails(setDoc(doc(customer, 'addresses', 'inactive-zone'), {
    ownerId: 'customer-1', zoneId: 'zone-off', street: 'Calle', city: 'Ciudad', alias: 'Casa', createdAt: NOW,
  }))
  await assertFails(setDoc(doc(customer, 'addresses', 'foreign-owner'), {
    ownerId: 'customer-2', zoneId: 'zone-1', street: 'Calle', city: 'Ciudad', alias: 'Casa', createdAt: NOW,
  }))
})

test('order rejects foreign references, stale version and financial injection', async () => {
  const customer = dbFor('customer-1')
  await assertFails(setDoc(doc(customer, 'serviceOrders', 'foreign-dog'), { ...order, dogIds: ['dog-2'] }))
  await assertFails(setDoc(doc(customer, 'serviceOrders', 'foreign-address'), { ...order, addressId: 'address-2' }))
  await assertFails(setDoc(doc(customer, 'serviceOrders', 'stale'), { ...order, serviceVersion: 2 }))
  await assertFails(setDoc(doc(customer, 'serviceOrders', 'price'), { ...order, totalCents: 3000 }))
  await assertFails(setDoc(doc(customer, 'serviceOrders', 'discount'), { ...order, discountCents: 100 }))
  await assertFails(setDoc(doc(customer, 'serviceOrders', 'walker'), { ...order, walkerId: 'walker-1' }))
})

test('inactive, unpriced and implicit-zero services are not reservable', async () => {
  const customer = dbFor('customer-1')
  await seed(async (db) => {
    await setDoc(doc(db, 'appSettings', 'servicePrices'), {
      services: { 'paseo-individual': { ...publicService, active: false } },
    })
  })
  await assertFails(setDoc(doc(customer, 'serviceOrders', 'inactive'), order))
  await seed(async (db) => {
    await setDoc(doc(db, 'appSettings', 'servicePrices'), {
      services: { 'paseo-individual': { ...publicService, amountCents: null, active: true } },
    })
  })
  await assertFails(setDoc(doc(customer, 'serviceOrders', 'unpriced'), order))
  await seed(async (db) => {
    await setDoc(doc(db, 'appSettings', 'servicePrices'), {
      services: { 'paseo-individual': { ...publicService, amountCents: 0, complimentary: false } },
    })
  })
  await assertFails(setDoc(doc(customer, 'serviceOrders', 'zero'), order))
})

test('session rejects every inconsistent canonical reference', async () => {
  await seed(async (db) => setDoc(doc(db, 'serviceOrders', 'order-1'), order))
  const customer = dbFor('customer-1')
  await assertFails(setDoc(doc(customer, 'walkSessions', 'customer'), { ...requestedSession, customerId: 'customer-2' }))
  await assertFails(setDoc(doc(customer, 'walkSessions', 'dog'), { ...requestedSession, dogIds: ['dog-2'] }))
  await assertFails(setDoc(doc(customer, 'walkSessions', 'address'), { ...requestedSession, addressId: 'address-2' }))
  await assertFails(setDoc(doc(customer, 'walkSessions', 'service'), { ...requestedSession, serviceId: 'otro' }))
  await assertFails(setDoc(doc(customer, 'walkSessions', 'version'), { ...requestedSession, serviceVersion: 2 }))
  await assertFails(setDoc(doc(customer, 'walkSessions', 'date'), { ...requestedSession, scheduledDate: '2026-08-31' }))
  await assertFails(setDoc(doc(customer, 'walkSessions', 'time'), { ...requestedSession, arrivalWindowEnd: '12:00' }))
  await assertFails(setDoc(doc(customer, 'walkSessions', 'assigned'), { ...requestedSession, walkerId: 'walker-1' }))
})

test.each(['admin', 'supervisor'])('%s assigns only an active Walker without changing identity', async (role) => {
  await seed(async (db) => setDoc(doc(db, 'walkSessions', 'session-1'), requestedSession))
  const staff = dbFor(`${role}-1`, role)
  const sessionRef = doc(staff, 'walkSessions', 'session-1')
  await assertSucceeds(updateDoc(sessionRef, {
    status: 'assigned', walkerId: 'walker-1', assignedBy: `${role}-1`, assignedAt: NOW, updatedAt: NOW,
  }))
  await assertFails(updateDoc(sessionRef, { customerId: 'customer-2', updatedAt: NOW }))
  await assertFails(updateDoc(sessionRef, { paymentStatus: 'confirmed', updatedAt: NOW }))
})

test('customer cannot assign and active Walker only transitions its own session sequentially', async () => {
  await seed(async (db) => setDoc(doc(db, 'walkSessions', 'session-1'), {
    ...requestedSession, status: 'assigned', walkerId: 'walker-1', assignedBy: 'admin-1', assignedAt: NOW,
  }))
  await assertFails(updateDoc(doc(dbFor('customer-1'), 'walkSessions', 'session-1'), {
    walkerId: 'customer-1', status: 'assigned', updatedAt: NOW,
  }))
  const walkerRef = doc(dbFor('walker-1', 'walker'), 'walkSessions', 'session-1')
  await assertSucceeds(getDoc(walkerRef))
  await assertSucceeds(updateDoc(walkerRef, { status: 'confirmed', confirmedAt: NOW, updatedAt: NOW }))
  await assertFails(updateDoc(walkerRef, { status: 'completed', completedAt: NOW, updatedAt: NOW }))
  await assertFails(updateDoc(walkerRef, { totalCents: 3000, updatedAt: NOW }))
})
