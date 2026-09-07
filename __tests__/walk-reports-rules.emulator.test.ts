/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'

const PROJECT_ID = 'demo-pet-walk-reports'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active' })
    await setDoc(doc(db, 'walkerProfiles', 'walker-2'), { status: 'active' })
    await setDoc(doc(db, 'walkerProfiles', 'walker-inactive'), { status: 'inactive' })
    await setDoc(doc(db, 'walkerProfiles', 'walker-suspended'), { status: 'suspended' })
    const base = {
      orderId: 'order-1', customerId: 'customer-1', dogIds: ['dog-1'],
      addressId: 'address-1', serviceId: 'paseo-individual', serviceVersion: 1,
      scheduledDate: '2026-08-24', scheduledStart: '10:00',
      arrivalWindowStart: '10:00', arrivalWindowEnd: '11:00',
      walkerId: 'walker-1', status: 'completed', createdAt: NOW,
    }
    await setDoc(doc(db, 'walkSessions', 'session-completed'), base)
    await setDoc(doc(db, 'walkSessions', 'session-active'), { ...base, status: 'in_progress' })
  })
}

function report(sessionId: string, status: 'draft' | 'submitted' = 'draft') {
  return {
    walkSessionId: sessionId, orderId: 'order-1', customerId: 'customer-1',
    walkerId: 'walker-1', dogIds: ['dog-1'], status,
    summary: status === 'submitted' ? 'Paseo completado' : '',
    behaviorNotes: '', bathroomNotes: '', waterProvided: true,
    incidentsSummary: '', mediaReferences: [], createdBy: 'walker-1',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), submittedAt: status === 'submitted' ? serverTimestamp() : null,
    schemaVersion: 1,
  }
}

beforeAll(async () => {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST?.split(':')
  const rulesPath = process.env.WALK_REPORT_RULES_PATH
  if (!hostPort?.[0] || !hostPort[1] || !rulesPath) throw new Error('FIRESTORE_EMULATOR_HOST and WALK_REPORT_RULES_PATH are required')
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: hostPort[0], port: Number(hostPort[1]), rules: readFileSync(rulesPath, 'utf8') },
  })
})

beforeEach(async () => { await env.clearFirestore(); await seed() })
afterAll(async () => env.cleanup())

describe('canonical walk report rules', () => {
  test('assigned Walker and own customer can get an absent report path without broadening access', async () => {
    await assertSucceeds(getDoc(doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-completed')))
    await assertSucceeds(getDoc(doc(dbFor('customer-1'), 'walkReports', 'session-completed')))
    await assertSucceeds(getDoc(doc(dbFor('customer-1', 'customer'), 'walkReports', 'session-completed')))
    await assertSucceeds(getDoc(doc(dbFor('customer-1', 'client'), 'walkReports', 'session-completed')))
    await assertFails(getDoc(doc(dbFor('walker-2', 'walker'), 'walkReports', 'session-completed')))
    await assertFails(getDoc(doc(dbFor('walker-inactive', 'walker'), 'walkReports', 'session-completed')))
    await assertFails(getDoc(doc(dbFor('walker-suspended', 'walker'), 'walkReports', 'session-completed')))
    await assertFails(getDoc(doc(dbFor('customer-2'), 'walkReports', 'session-completed')))
    await assertFails(getDoc(doc(dbFor('customer-1', 'unknown-role'), 'walkReports', 'session-completed')))
    const anonymousDb = env.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(getDoc(doc(anonymousDb, 'walkReports', 'session-completed')))
  })

  test('assigned active walker saves one deterministic draft', async () => {
    const ref = doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-completed')
    await assertSucceeds(setDoc(ref, report('session-completed')))
    await assertSucceeds(updateDoc(ref, { summary: 'Borrador actualizado', updatedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(dbFor('walker-1', 'walker'), 'walkReports', 'other-id'), report('session-completed')))
  })

  test('other and inactive walkers cannot write the report', async () => {
    await assertFails(setDoc(doc(dbFor('walker-2', 'walker'), 'walkReports', 'session-completed'), { ...report('session-completed'), walkerId: 'walker-2', createdBy: 'walker-2' }))
    await assertFails(setDoc(doc(dbFor('walker-inactive', 'walker'), 'walkReports', 'session-completed'), { ...report('session-completed'), walkerId: 'walker-inactive', createdBy: 'walker-inactive' }))
  })

  test('previous walker cannot edit a draft after reassignment', async () => {
    const walkerRef = doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-completed')
    await assertSucceeds(setDoc(walkerRef, report('session-completed')))
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore() as unknown as Firestore, 'walkSessions', 'session-completed'), { walkerId: 'walker-2' })
    })
    await assertFails(getDoc(walkerRef))
    await assertFails(updateDoc(walkerRef, { summary: 'Edición posterior', updatedAt: serverTimestamp() }))
  })

  test('submission requires completed session and becomes immutable', async () => {
    await assertFails(setDoc(doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-active'), report('session-active', 'submitted')))
    const ref = doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-completed')
    await assertSucceeds(setDoc(ref, report('session-completed', 'submitted')))
    await assertFails(updateDoc(ref, { summary: 'Sobrescrito', updatedAt: serverTimestamp() }))
  })

  test('private media and identity changes fail closed', async () => {
    await assertFails(setDoc(doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-completed'), { ...report('session-completed'), mediaReferences: ['https://public.example/photo'] }))
    await assertFails(setDoc(doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-completed'), { ...report('session-completed'), customerId: 'customer-2' }))
  })

  test('customer reads only own submitted report; staff reads operationally', async () => {
    const walkerRef = doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-completed')
    await assertSucceeds(setDoc(walkerRef, report('session-completed', 'submitted')))
    await assertSucceeds(getDoc(doc(dbFor('customer-1', 'customer'), 'walkReports', 'session-completed')))
    await assertSucceeds(getDoc(doc(dbFor('customer-1'), 'walkReports', 'session-completed')))
    await assertSucceeds(getDoc(doc(dbFor('customer-1', 'client'), 'walkReports', 'session-completed')))
    await assertFails(getDoc(doc(dbFor('customer-2', 'customer'), 'walkReports', 'session-completed')))
    await assertSucceeds(getDoc(doc(dbFor('admin-1', 'admin'), 'walkReports', 'session-completed')))
    await assertSucceeds(getDoc(doc(dbFor('supervisor-1', 'supervisor'), 'walkReports', 'session-completed')))
    await assertFails(getDoc(doc(dbFor('anonymous-role'), 'walkReports', 'session-completed')))
  })

  test('unknown and internal claims never inherit customer compatibility', async () => {
    await assertSucceeds(setDoc(doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-completed'), report('session-completed', 'submitted')))
    await assertFails(getDoc(doc(dbFor('customer-1', 'unknown-role'), 'walkReports', 'session-completed')))
    await assertFails(getDoc(doc(dbFor('customer-1', 'walker'), 'walkReports', 'session-completed')))
  })

  test('claimless customer cannot enumerate reports globally', async () => {
    await assertSucceeds(setDoc(doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-completed'), report('session-completed', 'submitted')))
    await assertFails(getDocs(collection(dbFor('customer-1'), 'walkReports')))
  })

  test('customer cannot read a draft or create reports', async () => {
    await assertSucceeds(setDoc(doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-completed'), report('session-completed')))
    await assertFails(getDoc(doc(dbFor('customer-1'), 'walkReports', 'session-completed')))
    await assertFails(setDoc(doc(dbFor('customer-1'), 'walkReports', 'customer-report'), report('session-completed')))
    await assertFails(updateDoc(doc(dbFor('customer-1'), 'walkReports', 'session-completed'), { summary: 'Alterado', updatedAt: serverTimestamp() }))
  })

  test('inconsistent or orphan submitted reports fail closed for customer', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      const base = {
        ...report('session-completed', 'submitted'),
        createdAt: NOW,
        updatedAt: NOW,
        submittedAt: NOW,
      }
      await setDoc(doc(db, 'walkReports', 'session-completed'), { ...base, customerId: 'customer-2' })
      await setDoc(doc(db, 'walkReports', 'missing-session'), { ...base, walkSessionId: 'missing-session' })
    })
    await assertFails(getDoc(doc(dbFor('customer-1'), 'walkReports', 'session-completed')))
    await assertFails(getDoc(doc(dbFor('customer-1'), 'walkReports', 'missing-session')))
  })
})
