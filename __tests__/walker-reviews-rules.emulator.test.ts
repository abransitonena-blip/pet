/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore'

/**
 * Una reseña vale por quién la escribe. Estas pruebas fijan lo único que la
 * hace confiable: sólo la deja la familia de un paseo que de verdad ocurrió,
 * una vez, y no se puede reescribir después.
 */

const PROJECT_ID = 'demo-pet-walker-reviews'
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

const review = (over: Record<string, unknown> = {}) => ({
  sessionId: 'paseo-1',
  walkerId: 'paseador-1',
  customerId: 'familia-1',
  rating: 5,
  text: 'Muy atento con Tobi',
  createdAt: serverTimestamp(),
  ...over,
})

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
    await setDoc(doc(db, 'walkSessions', 'paseo-1'), {
      customerId: 'familia-1', walkerId: 'paseador-1', status: 'completed', scheduledDate: '2026-09-10',
    })
    await setDoc(doc(db, 'walkSessions', 'paseo-en-curso'), {
      customerId: 'familia-1', walkerId: 'paseador-1', status: 'in_progress', scheduledDate: '2026-09-13',
    })
    await setDoc(doc(db, 'walkSessions', 'paseo-ajeno'), {
      customerId: 'familia-2', walkerId: 'paseador-1', status: 'completed', scheduledDate: '2026-09-09',
    })
  })
})

afterAll(async () => env.cleanup())

describe('quién puede calificar', () => {
  test('la familia de un paseo terminado', async () => {
    await assertSucceeds(setDoc(doc(dbFor('familia-1', 'customer'), 'walkerReviews', 'paseo-1'), review()))
  })

  test('no se puede calificar un paseo que todavía no termina', async () => {
    await assertFails(setDoc(doc(dbFor('familia-1', 'customer'), 'walkerReviews', 'paseo-en-curso'),
      review({ sessionId: 'paseo-en-curso' })))
  })

  test('no se puede calificar el paseo de otra familia', async () => {
    await assertFails(setDoc(doc(dbFor('familia-1', 'customer'), 'walkerReviews', 'paseo-ajeno'),
      review({ sessionId: 'paseo-ajeno' })))
  })

  test('no se puede calificar un paseo que no existe', async () => {
    await assertFails(setDoc(doc(dbFor('familia-1', 'customer'), 'walkerReviews', 'paseo-inventado'),
      review({ sessionId: 'paseo-inventado' })))
  })

  test('no se le puede achacar la reseña a un paseador que no lo llevó', async () => {
    await assertFails(setDoc(doc(dbFor('familia-1', 'customer'), 'walkerReviews', 'paseo-1'),
      review({ walkerId: 'paseador-2' })))
  })

  test('nadie firma a nombre de otra familia', async () => {
    await assertFails(setDoc(doc(dbFor('familia-1', 'customer'), 'walkerReviews', 'paseo-1'),
      review({ customerId: 'familia-2' })))
  })

  test('el paseador no se califica a sí mismo', async () => {
    await assertFails(setDoc(doc(dbFor('paseador-1', 'walker'), 'walkerReviews', 'paseo-1'),
      review({ customerId: 'paseador-1' })))
  })
})

describe('qué se puede escribir', () => {
  test('las estrellas van de 1 a 5', async () => {
    const familia = dbFor('familia-1', 'customer')
    await assertFails(setDoc(doc(familia, 'walkerReviews', 'paseo-1'), review({ rating: 0 })))
    await assertFails(setDoc(doc(familia, 'walkerReviews', 'paseo-1'), review({ rating: 6 })))
    await assertFails(setDoc(doc(familia, 'walkerReviews', 'paseo-1'), review({ rating: 4.5 })))
  })

  test('el comentario tiene tope, y no entran campos de más', async () => {
    const familia = dbFor('familia-1', 'customer')
    await assertFails(setDoc(doc(familia, 'walkerReviews', 'paseo-1'), review({ text: 'a'.repeat(601) })))
    await assertFails(setDoc(doc(familia, 'walkerReviews', 'paseo-1'), review({ destacada: true })))
  })
})

describe('una reseña no se reescribe', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(doc(db, 'walkerReviews', 'paseo-1'), {
        sessionId: 'paseo-1', walkerId: 'paseador-1', customerId: 'familia-1', rating: 2, text: 'Llegó tarde', createdAt: serverTimestamp(),
      })
    })
  })

  test('ni la familia que la escribió puede cambiarla', async () => {
    await assertFails(updateDoc(doc(dbFor('familia-1', 'customer'), 'walkerReviews', 'paseo-1'), { rating: 5 }))
  })

  test('ni el paseador calificado, ni administración', async () => {
    await assertFails(updateDoc(doc(dbFor('paseador-1', 'walker'), 'walkerReviews', 'paseo-1'), { rating: 5 }))
    await assertFails(updateDoc(doc(dbFor('admin-1', 'admin'), 'walkerReviews', 'paseo-1'), { rating: 5 }))
  })
})

describe('quién puede leerlas', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(doc(db, 'walkerReviews', 'paseo-1'), {
        sessionId: 'paseo-1', walkerId: 'paseador-1', customerId: 'familia-1', rating: 5, text: '', createdAt: serverTimestamp(),
      })
    })
  })

  test('el paseador calificado, la familia que la escribió y el equipo', async () => {
    await assertSucceeds(getDoc(doc(dbFor('paseador-1', 'walker'), 'walkerReviews', 'paseo-1')))
    await assertSucceeds(getDoc(doc(dbFor('familia-1', 'customer'), 'walkerReviews', 'paseo-1')))
    await assertSucceeds(getDoc(doc(dbFor('admin-1', 'admin'), 'walkerReviews', 'paseo-1')))
  })

  test('un tercero no', async () => {
    await assertFails(getDoc(doc(dbFor('familia-2', 'customer'), 'walkerReviews', 'paseo-1')))
    await assertFails(getDoc(doc(dbFor('paseador-2', 'walker'), 'walkerReviews', 'paseo-1')))
  })

  test('un paseador lista las suyas, pero no las de otro', async () => {
    const paseador = dbFor('paseador-1', 'walker')
    await assertSucceeds(getDocs(query(collection(paseador, 'walkerReviews'), where('walkerId', '==', 'paseador-1'), limit(100))))
    await assertFails(getDocs(query(collection(paseador, 'walkerReviews'), where('walkerId', '==', 'paseador-2'), limit(100))))
  })

  test('nadie se lleva la colección entera sin límite', async () => {
    await assertFails(getDocs(collection(dbFor('admin-1', 'admin'), 'walkerReviews')))
  })
})
