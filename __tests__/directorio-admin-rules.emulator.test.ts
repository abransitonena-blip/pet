/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDocs, limit, query, setDoc, startAfter, type Firestore } from 'firebase/firestore'

/**
 * El directorio de admin pedía 600 perros de un tiro y las reglas topan las
 * listas de `dogs` en 100. Firestore no devuelve una lista corta: rechaza la
 * consulta entera, así que Perros, Familias e Insights mostraban "tu sesión no
 * tiene permiso" y ninguna prueba lo veía, porque ninguna listaba como admin.
 */

const PROJECT_ID = 'demo-pet-directory'
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
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
    for (let index = 0; index < 120; index += 1) {
      await setDoc(doc(db, 'dogs', `dog-${String(index).padStart(3, '0')}`), {
        ownerId: `customer-${index % 3}`, name: `Perro ${index}`, breed: 'Mestizo',
      })
    }
  })
})

afterAll(async () => env.cleanup())

describe('el directorio de perros del panel de admin', () => {
  test('pedir más de cien de un tiro lo rechaza la regla', async () => {
    await assertFails(getDocs(query(collection(dbFor('admin-1', 'admin'), 'dogs'), limit(600))))
  })

  test('de cien en cien sí, y las páginas siguientes traen el resto', async () => {
    const db = dbFor('admin-1', 'admin')
    const first = await assertSucceeds(getDocs(query(collection(db, 'dogs'), limit(100))))
    expect(first.docs).toHaveLength(100)

    const cursor = first.docs[first.docs.length - 1]
    const second = await assertSucceeds(getDocs(query(collection(db, 'dogs'), startAfter(cursor), limit(100))))
    expect(second.docs).toHaveLength(20)
    const ids = new Set([...first.docs, ...second.docs].map((item) => item.id))
    expect(ids.size).toBe(120)
  })

  test('una familia no puede listar el directorio completo, ni de cien en cien', async () => {
    const db = dbFor('customer-0', 'customer')
    await assertFails(getDocs(query(collection(db, 'dogs'), limit(100))))
  })
})
