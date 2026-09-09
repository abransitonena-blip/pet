/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'

const PROJECT_ID = 'demo-pet-ahora-dispatch'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

beforeAll(async () => {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST!.split(':')
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: hostPort[0],
      port: Number(hostPort[1]),
      rules: readFileSync(process.env.FIRESTORE_RULES_PATH!, 'utf8'),
    },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    await setDoc(doc(db, 'users', 'customer-1'), { status: 'active' })
    await setDoc(doc(db, 'customerProfiles', 'customer-1'), { name: 'Ana', email: 'a@b.mx', phone: '', createdAt: NOW })
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active' })
  })
})

afterAll(async () => env.cleanup())

/**
 * Por qué el despacho de PET Ahora vive en el servidor.
 *
 * These three cases are the reason: the customer may create their own request
 * and nothing else. The original hook tried to do all three from the browser,
 * so a request was created and then stranded until it expired -- which is what
 * "PET Ahora nunca funcionó" looked like from outside. If a future change ever
 * makes the two denials below start passing, the client-side shortcut becomes
 * possible again and this test should be revisited deliberately, not deleted.
 */
describe('PET Ahora desde el navegador del cliente', () => {
  test('el cliente puede crear su propia solicitud', async () => {
    const db = dbFor('customer-1', 'customer')
    await assertSucceeds(addDoc(collection(db, 'petAhoraRequests'), {
      clientId: 'customer-1', status: 'pending', requestedAt: NOW, expiresAt: NOW,
    }))
  })

  test('el cliente NO puede moverla a searching', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(doc(db, 'petAhoraRequests', 'req-1'), {
        clientId: 'customer-1', status: 'pending', requestedAt: NOW, expiresAt: NOW,
      })
    })
    const db = dbFor('customer-1', 'customer')
    await assertFails(updateDoc(doc(db, 'petAhoraRequests', 'req-1'), { status: 'searching' }))
  })

  test('el cliente NO puede crear la oferta para un paseador', async () => {
    const db = dbFor('customer-1', 'customer')
    await assertFails(addDoc(collection(db, 'petAhoraOffers'), {
      requestId: 'req-1', walkerId: 'walker-1', status: 'pending', sentAt: NOW,
    }))
  })
})
