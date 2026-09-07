/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'

const PROJECT_ID = 'demo-pet-tickets-t2'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

function report(status: 'draft' | 'submitted' = 'submitted', walkerId = 'walker-1') {
  return {
    walkSessionId: 'session-1', orderId: 'order-1', customerId: 'customer-1', walkerId, dogIds: ['dog-1'], status,
    summary: status === 'submitted' ? 'Paseo completado' : '', behaviorNotes: '', bathroomNotes: '', waterProvided: true,
    incidentsSummary: '', mediaReferences: [], createdBy: walkerId, createdAt: NOW, updatedAt: NOW,
    submittedAt: status === 'submitted' ? NOW : null, schemaVersion: 1,
  }
}

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1, documentType: 'internal-receipt', isCfdi: false, currency: 'MXN',
    folio: 'TKT-session-1', serviceFolio: 'PET-session-1', walkSessionId: 'session-1', walkReportId: 'session-1',
    customerId: 'customer-1', walkerId: 'walker-1', dogIds: ['dog-1'], customerName: 'Familia PET',
    dogNames: { 'dog-1': 'Tobi' }, walkerName: 'Paseador PET', serviceId: 'paseo-individual', serviceName: 'Paseo Individual',
    durationMinutes: 60, serviceDate: '2026-08-25', startTime: '10:00', endTime: '11:00',
    reportUrl: 'https://pet-euhz.vercel.app/familia/reportes/session-1', verificationCode: 'ABC123',
    paymentStatus: 'not_recorded', subtotalCents: null, discountCents: null, tipCents: null, totalCents: null,
    amountPaidCents: null, balanceDueCents: null, paymentMethod: null, createdAt: serverTimestamp(), createdBy: 'admin-1', status: 'active',
    ...overrides,
  }
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    ticketId: 'session-1', actorUid: 'admin-1', mode: 'original', transport: 'manual_hex', status: 'payload_exported',
    payloadHash: 'a'.repeat(64), byteLength: 512, createdAt: serverTimestamp(), ...overrides,
  }
}

async function seed(sessionStatus = 'completed', reportStatus: 'draft' | 'submitted' = 'submitted') {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active' })
    await setDoc(doc(db, 'walkerProfiles', 'walker-2'), { status: 'active' })
    await setDoc(doc(db, 'walkerProfiles', 'walker-inactive'), { status: 'inactive' })
    await setDoc(doc(db, 'walkSessions', 'session-1'), {
      orderId: 'order-1', customerId: 'customer-1', walkerId: 'walker-1', dogIds: ['dog-1'], addressId: 'address-1',
      serviceId: 'paseo-individual', serviceVersion: 1, scheduledDate: '2026-08-25', scheduledStart: '10:00',
      arrivalWindowStart: '10:00', arrivalWindowEnd: '11:00', status: sessionStatus, createdAt: NOW,
    })
    await setDoc(doc(db, 'walkReports', 'session-1'), report(reportStatus))
  })
}

beforeAll(async () => {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST?.split(':')
  if (!hostPort?.[0] || !hostPort[1]) throw new Error('FIRESTORE_EMULATOR_HOST is required')
  env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { host: hostPort[0], port: Number(hostPort[1]), rules: readFileSync(process.env.TICKET_RULES_PATH || 'firestore.rules', 'utf8') } })
})
beforeEach(async () => { await env.clearFirestore(); await seed() })
afterAll(async () => env.cleanup())

describe('T2 ticket and print event rules', () => {
  test('Admin creates one valid immutable ticket; Supervisor only reads', async () => {
    const ref = doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1')
    await assertSucceeds(setDoc(ref, ticket()))
    await assertFails(setDoc(ref, ticket()))
    await assertFails(updateDoc(ref, { serviceName: 'Alterado' }))
    await assertFails(deleteDoc(ref))
    await assertSucceeds(getDoc(doc(dbFor('supervisor-1', 'supervisor'), 'tickets', 'session-1')))
    await assertFails(setDoc(doc(dbFor('supervisor-1', 'supervisor'), 'tickets', 'session-2'), ticket({ walkSessionId: 'session-2' })))
  })

  test('creation fails closed for incomplete session, draft report and inconsistent references', async () => {
    await env.clearFirestore(); await seed('in_progress', 'submitted')
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1'), ticket()))
    await env.clearFirestore(); await seed('completed', 'draft')
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1'), ticket()))
    await env.clearFirestore(); await seed()
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1'), ticket({ customerId: 'customer-2' })))
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1'), ticket({ folio: 'TKT-MANIPULADO' })))
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1'), ticket({ totalCents: 100 })))
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1'), ticket({ financialMovementId: 'movement-1' })))
  })

  test('Customer and Walker cannot create; own point reads succeed without global lists', async () => {
    await assertFails(setDoc(doc(dbFor('customer-1'), 'tickets', 'session-1'), ticket({ createdBy: 'customer-1' })))
    await assertFails(setDoc(doc(dbFor('walker-1', 'walker'), 'tickets', 'session-1'), ticket({ createdBy: 'walker-1' })))
    await assertSucceeds(getDoc(doc(dbFor('customer-1'), 'tickets', 'session-1')))
    await assertSucceeds(getDoc(doc(dbFor('walker-1', 'walker'), 'tickets', 'session-1')))
    await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore() as unknown as Firestore, 'tickets', 'session-1'), { ...ticket(), createdAt: NOW }) })
    await assertSucceeds(getDoc(doc(dbFor('customer-1'), 'tickets', 'session-1')))
    await assertSucceeds(getDoc(doc(dbFor('walker-1', 'walker'), 'tickets', 'session-1')))
    await assertFails(getDoc(doc(dbFor('customer-2'), 'tickets', 'session-1')))
    await assertFails(getDoc(doc(dbFor('walker-2', 'walker'), 'tickets', 'session-1')))
    await assertFails(getDoc(doc(dbFor('walker-inactive', 'walker'), 'tickets', 'session-1')))
    await assertFails(getDocs(collection(dbFor('customer-1'), 'tickets')))
    await assertFails(getDocs(collection(dbFor('walker-1', 'walker'), 'tickets')))
    await assertSucceeds(getDocs(query(collection(dbFor('admin-1', 'admin'), 'tickets'), limit(50))))
  })

  test('previous Walker loses ticket access after reassignment', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(doc(db, 'tickets', 'session-1'), { ...ticket(), createdAt: NOW })
      await updateDoc(doc(db, 'walkSessions', 'session-1'), { walkerId: 'walker-2' })
    })
    await assertFails(getDoc(doc(dbFor('walker-1', 'walker'), 'tickets', 'session-1')))
  })

  test('Admin records immutable non-financial print events', async () => {
    await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore() as unknown as Firestore, 'tickets', 'session-1'), { ...ticket(), createdAt: NOW }) })
    const ref = doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1', 'printEvents', 'event-1')
    await assertSucceeds(setDoc(ref, event()))
    await assertFails(updateDoc(ref, { status: 'operator_confirmed' }))
    await assertFails(deleteDoc(ref))
    await assertFails(setDoc(doc(dbFor('customer-1'), 'tickets', 'session-1', 'printEvents', 'event-2'), event({ actorUid: 'customer-1' })))
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1', 'printEvents', 'event-3'), event({ paymentId: 'payment-1' })))
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1', 'printEvents', 'event-4'), event({ status: 'printed' })))
    await assertSucceeds(setDoc(doc(dbFor('admin-1', 'admin'), 'tickets', 'session-1', 'printEvents', 'event-5'), event({ status: 'failed', errorCode: 'clipboard_unavailable' })))
    await assertFails(getDocs(query(collection(dbFor('customer-1'), 'tickets', 'session-1', 'printEvents'), limit(50))))
    await assertSucceeds(getDocs(query(collection(dbFor('supervisor-1', 'supervisor'), 'tickets', 'session-1', 'printEvents'), limit(50))))
  })
})

