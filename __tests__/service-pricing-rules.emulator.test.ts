/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'

const PROJECT_ID = 'demo-pet-pricing'
const RULES_PATH = process.env.FIRESTORE_RULES_PATH || 'firestore.rules'
let env: RulesTestEnvironment

const definitions = [
  ['paseo-individual', 'Paseo Individual', '30 min'],
  ['paseo-extendido', 'Paseo Extendido', '1 hora'],
  ['paseo-grupal', 'Paseo Grupal', '45 min'],
  ['paseo-adiestramiento', 'Paseo + Adiestramiento', '1 hora'],
  ['paseo-esencial', 'Paseo Esencial', '20 min'],
  ['paseo-seguimiento', 'Paseo + Seguimiento', '45 min'],
  ['paquete-semanal', 'Paquete Semanal', '6 paseos'],
] as const

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

function publicServices(version = 1) {
  return Object.fromEntries(definitions.map(([id, name, duration]) => [id, {
    id, name, duration, amountCents: id === 'paseo-individual' ? 18_000 : null,
    currency: 'MXN', active: id === 'paseo-individual', complimentary: false, version,
  }]))
}

function adminServices(uid: string, version = 1) {
  return Object.fromEntries(Object.entries(publicServices(version)).map(([id, service]) => [id, {
    ...service, updatedAt: serverTimestamp(), updatedBy: uid,
  }]))
}

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '').split(':')
  if (!host || !port) throw new Error('FIRESTORE_EMULATOR_HOST is required')
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host, port: Number(port), rules: readFileSync(RULES_PATH, 'utf8') },
  })
})

afterAll(async () => env?.cleanup())
beforeEach(async () => env.clearFirestore())

test('Admin guarda configuración privada y proyección pública en un batch', async () => {
  const db = dbFor('admin-1', 'admin')
  const batch = writeBatch(db)
  batch.set(doc(db, 'admin', 'prices'), { schemaVersion: 1, version: 1, services: adminServices('admin-1'), updatedAt: serverTimestamp(), updatedBy: 'admin-1' })
  batch.set(doc(db, 'appSettings', 'servicePrices'), { schemaVersion: 1, version: 1, services: publicServices(), updatedAt: serverTimestamp() })
  await assertSucceeds(batch.commit())
  await assertSucceeds(getDoc(doc(dbFor('customer-1'), 'appSettings', 'servicePrices')))
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'appSettings', 'servicePrices')))
  await assertFails(getDoc(doc(dbFor('customer-1'), 'admin', 'prices')))
})

test('customer y supervisor no pueden escribir precios', async () => {
  const payload = { schemaVersion: 1, version: 1, services: publicServices(), updatedAt: serverTimestamp() }
  await assertFails(setDoc(doc(dbFor('customer-1'), 'appSettings', 'servicePrices'), payload))
  await assertFails(setDoc(doc(dbFor('supervisor-1', 'supervisor'), 'appSettings', 'servicePrices'), payload))
})

test('rechaza cero sin cortesía y cambios que no incrementan versión', async () => {
  const admin = dbFor('admin-1', 'admin')
  const invalid = publicServices()
  invalid['paseo-individual'] = { ...invalid['paseo-individual'], amountCents: 0, complimentary: false }
  await assertFails(setDoc(doc(admin, 'appSettings', 'servicePrices'), { schemaVersion: 1, version: 1, services: invalid, updatedAt: serverTimestamp() }))
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'appSettings', 'servicePrices'), { schemaVersion: 1, version: 1, services: publicServices(), updatedAt: new Date() })
  })
  await assertFails(updateDoc(doc(admin, 'appSettings', 'servicePrices'), { version: 1, updatedAt: serverTimestamp() }))
})

test('customer crea solicitud versionada sin importe y no puede inyectar campos financieros', async () => {
  const customer = dbFor('customer-1')
  await env.withSecurityRulesDisabled(async (context) => {
    const seedDb = context.firestore() as unknown as Firestore
    await setDoc(doc(seedDb, 'zones', 'zone-1'), { name: 'La Quebrada', active: true })
    await setDoc(doc(seedDb, 'dogs', 'dog-1'), { ownerId: 'customer-1' })
    await setDoc(doc(seedDb, 'addresses', 'address-1'), { ownerId: 'customer-1', zoneId: 'zone-1' })
    await setDoc(doc(seedDb, 'appSettings', 'servicePrices'), {
      schemaVersion: 1, version: 1, services: publicServices(), updatedAt: new Date(),
    })
  })
  const order = {
    customerId: 'customer-1', dogIds: ['dog-1'], serviceId: 'paseo-individual', serviceName: 'Paseo Individual',
    packageType: 'individual', numberOfSessions: 1, addressId: 'address-1', notes: '', status: 'pending_confirmation',
    paymentStatus: 'pending', requestedSchedule: [{ date: '2026-08-30', time: '10:00-11:00' }],
    serviceVersion: 1, createdAt: serverTimestamp(),
  }
  const session = {
    orderId: 'order-1', customerId: 'customer-1', dogIds: ['dog-1'], addressId: 'address-1', serviceId: 'paseo-individual',
    scheduledDate: '2026-08-30', scheduledStart: '10:00', arrivalWindowStart: '10:00', arrivalWindowEnd: '11:00',
    notes: '', status: 'requested', serviceVersion: 1, createdAt: serverTimestamp(),
  }
  const batch = writeBatch(customer)
  batch.set(doc(customer, 'serviceOrders', 'order-1'), order)
  batch.set(doc(customer, 'walkSessions', 'session-1'), session)
  await assertSucceeds(batch.commit())
  await assertFails(setDoc(doc(customer, 'serviceOrders', 'order-financial'), { ...order, totalCents: 18_000 }))
})
