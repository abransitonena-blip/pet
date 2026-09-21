/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDocs, limit, orderBy, query, setDoc, where, type Firestore, type QueryDocumentSnapshot } from 'firebase/firestore'
import { loadFollowingPages, walkWindowQuery, type WalkWindowOwner } from '../src/lib/walkWindowQueries'

/**
 * Un mes con más de cien paseos no cabe en una consulta: las reglas topan cada
 * lista de paseos en 100 y Firestore no recorta, rechaza. Cabe en varias, cada
 * una con su cursor. Esto lo prueba contra las reglas de verdad: que las páginas
 * que siguen se aceptan, que no falta ni se repite ningún paseo, y que el tope
 * de cada consulta sigue siendo el de las reglas.
 */

const PROJECT_ID = 'demo-pet-long-months'
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

/** Un mes de `count` paseos de `walker-1`, repartidos en días distintos y varios el mismo día. */
async function seedMonth(count: number, walkerId = 'walker-1', customerId = 'customer-1') {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    for (let index = 0; index < count; index += 1) {
      const day = String((index % 28) + 1).padStart(2, '0')
      await setDoc(doc(db, 'walkSessions', `s${String(index).padStart(4, '0')}`), {
        walkerId, customerId, scheduledDate: `2026-08-${day}`, scheduledStart: '09:00', status: 'completed',
      })
    }
  })
}

const RANGE = { since: '2026-08-01', until: '2026-08-31' }
const WALKER: WalkWindowOwner = { field: 'walkerId', uid: 'walker-1' }

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
  // Las reglas sólo dejan listar a un paseador con perfil activo. Se siembran los dos,
  // para que "otro paseador no entra" falle por lo que dice y no por no tener perfil.
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    for (const uid of ['walker-1', 'walker-2']) await setDoc(doc(db, 'walkerProfiles', uid), { status: 'active' })
  })
})
afterAll(async () => env.cleanup())

async function firstPage(db: Firestore, owner = WALKER): Promise<QueryDocumentSnapshot[]> {
  return (await getDocs(walkWindowQuery(db, owner, RANGE))).docs
}

describe('un mes de 230 paseos, en tres consultas', () => {
  it('el paseador lee las tres páginas, sin que falte ni se repita ninguno', async () => {
    await seedMonth(230)
    const db = dbFor('walker-1', 'walker')
    const first = await assertSucceeds(firstPage(db))
    expect(first).toHaveLength(100)

    const following = await assertSucceeds(loadFollowingPages(db, WALKER, RANGE, first[first.length - 1]))
    expect(following.docs).toHaveLength(130)
    expect(following.beyond).toBe(false)

    const ids = [...first, ...following.docs].map((item) => item.id)
    expect(new Set(ids).size).toBe(230)
  })

  it('la familia, con su propio campo, también', async () => {
    await seedMonth(230)
    const db = dbFor('customer-1')
    const owner: WalkWindowOwner = { field: 'customerId', uid: 'customer-1' }
    const first = await assertSucceeds(firstPage(db, owner))
    const following = await assertSucceeds(loadFollowingPages(db, owner, RANGE, first[first.length - 1]))
    expect(first.length + following.docs.length).toBe(230)
  })

  it('un mes de exactamente 100 no inventa más: la página que sigue viene vacía', async () => {
    await seedMonth(100)
    const db = dbFor('walker-1', 'walker')
    const first = await firstPage(db)
    expect(first).toHaveLength(100)
    const following = await assertSucceeds(loadFollowingPages(db, WALKER, RANGE, first[first.length - 1]))
    expect(following.docs).toHaveLength(0)
    expect(following.beyond).toBe(false)
  })

  it('con un tope de páginas, dice que puede haber más en vez de callarlo', async () => {
    await seedMonth(230)
    const db = dbFor('walker-1', 'walker')
    const first = await firstPage(db)
    // Dos páginas en total: la primera y una más. Hay 30 sin leer.
    const following = await loadFollowingPages(db, WALKER, RANGE, first[first.length - 1], 2)
    expect(following.docs).toHaveLength(100)
    expect(following.beyond).toBe(true)
  })

  it('el orden sigue siendo por fecha, sin saltos entre páginas', async () => {
    await seedMonth(230)
    const db = dbFor('walker-1', 'walker')
    const first = await firstPage(db)
    const following = await loadFollowingPages(db, WALKER, RANGE, first[first.length - 1])
    const dates = [...first, ...following.docs].map((item) => String(item.data().scheduledDate))
    expect([...dates].sort()).toEqual(dates)
  })
})

describe('lo que las reglas siguen exigiendo', () => {
  it('cada consulta pide 100: pedir 101 se rechaza entera', async () => {
    await seedMonth(120)
    const db = dbFor('walker-1', 'walker')
    await assertFails(getDocs(query(
      collection(db, 'walkSessions'), where('walkerId', '==', 'walker-1'), orderBy('scheduledDate', 'asc'), limit(101),
    )))
  })

  it('otro paseador no lee las páginas de alguien más', async () => {
    await seedMonth(150)
    await assertFails(getDocs(walkWindowQuery(dbFor('walker-2', 'walker'), WALKER, RANGE)))
  })
})
