/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'

/**
 * walkShareLinks (fase 36) se escribe y se lee solo desde /api/tracking/share/*
 * con identidad privilegiada, que no pasa por estas reglas. Desde el
 * navegador -- familia dueña del paseo, paseador, staff, o quien sea -- nada
 * de esto se puede leer ni escribir: el token es el único secreto, y ninguna
 * regla puede condicionar un acceso a "si lo conoces".
 */

const PROJECT_ID = 'demo-pet-walk-share'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
const LATER = Timestamp.fromMillis(1_700_010_800_000)
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

function anon(): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore
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
    await setDoc(doc(db, 'walkSessions', 'session-1'), { customerId: 'family-1', walkerId: 'walker-1', status: 'in_progress' })
    await setDoc(doc(db, 'walkShareLinks', 'token-1'), {
      sessionId: 'session-1', customerId: 'family-1', createdAt: NOW, expiresAt: LATER, revokedAt: null,
    })
  })
})

afterAll(async () => env.cleanup())

describe('enlace temporal de ubicación (walkShareLinks)', () => {
  test('nadie lo lee desde el navegador, ni siquiera quien lo creó', async () => {
    await assertFails(getDoc(doc(dbFor('family-1', 'customer'), 'walkShareLinks', 'token-1')))
    await assertFails(getDoc(doc(dbFor('walker-1', 'walker'), 'walkShareLinks', 'token-1')))
    await assertFails(getDoc(doc(dbFor('admin-1', 'admin'), 'walkShareLinks', 'token-1')))
    await assertFails(getDoc(doc(dbFor('supervisor-1', 'supervisor'), 'walkShareLinks', 'token-1')))
    await assertFails(getDoc(doc(anon(), 'walkShareLinks', 'token-1')))
  })

  test('nadie lo crea desde el navegador', async () => {
    await assertFails(setDoc(doc(dbFor('family-1', 'customer'), 'walkShareLinks', 'token-2'), {
      sessionId: 'session-1', customerId: 'family-1', createdAt: NOW, expiresAt: LATER, revokedAt: null,
    }))
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'walkShareLinks', 'token-2'), {
      sessionId: 'session-1', customerId: 'admin-1', createdAt: NOW, expiresAt: LATER, revokedAt: null,
    }))
  })

  test('nadie lo revoca ni lo edita desde el navegador, ni el dueño del paseo', async () => {
    await assertFails(updateDoc(doc(dbFor('family-1', 'customer'), 'walkShareLinks', 'token-1'), { revokedAt: NOW }))
    await assertFails(updateDoc(doc(dbFor('admin-1', 'admin'), 'walkShareLinks', 'token-1'), { revokedAt: NOW }))
  })

  test('nadie lo borra desde el navegador', async () => {
    await assertFails(deleteDoc(doc(dbFor('family-1', 'customer'), 'walkShareLinks', 'token-1')))
    await assertFails(deleteDoc(doc(dbFor('admin-1', 'admin'), 'walkShareLinks', 'token-1')))
  })
})
