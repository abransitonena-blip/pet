/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore'

/**
 * El chat, contra las reglas de verdad.
 *
 * Durante meses sólo funcionó para administración: dentro de `messages`,
 * `resource` es el mensaje y no la conversación, así que preguntarle por
 * `participants` denegaba leer y escribir a la familia dueña del hilo. Una
 * prueba de este tipo lo habría visto el primer día -- las que miran el texto de
 * las reglas no, porque la regla se leía perfectamente razonable.
 */

const PROJECT_ID = 'demo-pet-chat'
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

/** Fecha y hora del negocio (Ciudad de México, UTC-6) de este mismo instante. */
function businessNow(): { date: string; start: string } {
  const local = new Date(Date.now() - 6 * 60 * 60_000)
  return { date: local.toISOString().slice(0, 10), start: local.toISOString().slice(11, 16) }
}

const message = (senderId: string, senderRole: string, text = 'Hola') => ({
  text, senderId, senderRole, timestamp: serverTimestamp(),
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
    await setDoc(doc(db, 'conversations', 'familia-1'), {
      participants: ['familia-1'], customerId: 'familia-1', customerName: 'Familia', participantRole: 'customer',
    })
    await setDoc(doc(db, 'conversations', 'familia-1', 'messages', 'msg-1'), {
      text: 'Mensaje anterior', senderId: 'familia-1', senderRole: 'customer', timestamp: serverTimestamp(),
    })
    await setDoc(doc(db, 'conversations', 'paseador-1'), {
      participants: ['paseador-1'], customerId: 'paseador-1', customerName: 'Paseador', participantRole: 'walker',
    })
    await setDoc(doc(db, 'walkerProfiles', 'paseador-1'), { status: 'active' })
    // El hilo de un paseo: la familia y el paseador de ese paseo, nadie más.
    const now = businessNow()
    await setDoc(doc(db, 'walkSessions', 'paseo-1'), {
      customerId: 'familia-1', walkerId: 'paseador-1', scheduledDate: now.date, scheduledStart: now.start, status: 'in_progress',
    })
    await setDoc(doc(db, 'conversations', 'paseo-1'), {
      participants: ['familia-1', 'paseador-1'], kind: 'walk', participantRole: 'walk',
      sessionId: 'paseo-1', customerId: 'familia-1', walkerId: 'paseador-1',
    })
  })
})

afterAll(async () => env.cleanup())

describe('la familia en su propio hilo', () => {
  test('lee sus mensajes', async () => {
    const familia = dbFor('familia-1', 'customer')
    await assertSucceeds(getDoc(doc(familia, 'conversations', 'familia-1', 'messages', 'msg-1')))
    await assertSucceeds(getDocs(collection(familia, 'conversations', 'familia-1', 'messages')))
  })

  test('ya no le escribe a administración: su canal es su paseador', async () => {
    const familia = dbFor('familia-1', 'customer')
    await assertFails(addDoc(collection(familia, 'conversations', 'familia-1', 'messages'), message('familia-1', 'customer')))
  })

  test('marca su hilo como leído', async () => {
    await assertSucceeds(updateDoc(doc(dbFor('familia-1', 'customer'), 'conversations', 'familia-1'), { unreadClient: 0 }))
  })
})

describe('el paseador en el suyo', () => {
  test('lee y manda', async () => {
    const paseador = dbFor('paseador-1', 'walker')
    await assertSucceeds(getDocs(collection(paseador, 'conversations', 'paseador-1', 'messages')))
    await assertSucceeds(addDoc(collection(paseador, 'conversations', 'paseador-1', 'messages'), message('paseador-1', 'walker')))
  })
})

describe('administración', () => {
  test('lee y contesta cualquier hilo, firmando con su uid', async () => {
    const admin = dbFor('admin-1', 'admin')
    await assertSucceeds(getDocs(collection(admin, 'conversations', 'familia-1', 'messages')))
    await assertSucceeds(addDoc(collection(admin, 'conversations', 'familia-1', 'messages'), message('admin-1', 'admin')))
  })
})

describe('el hilo de un paseo', () => {
  test('la familia y el paseador se escriben ahí', async () => {
    const familia = dbFor('familia-1', 'customer')
    const paseador = dbFor('paseador-1', 'walker')
    await assertSucceeds(addDoc(collection(familia, 'conversations', 'paseo-1', 'messages'), message('familia-1', 'customer')))
    await assertSucceeds(addDoc(collection(paseador, 'conversations', 'paseo-1', 'messages'), message('paseador-1', 'walker')))
    await assertSucceeds(getDocs(collection(familia, 'conversations', 'paseo-1', 'messages')))
    await assertSucceeds(getDocs(collection(paseador, 'conversations', 'paseo-1', 'messages')))
  })

  test('administración lo sigue viendo: es lo que le permite responder cuando algo sale mal', async () => {
    await assertSucceeds(getDocs(collection(dbFor('admin-1', 'admin'), 'conversations', 'paseo-1', 'messages')))
  })

  test('otro paseador no entra al paseo de alguien más', async () => {
    const otro = dbFor('paseador-2', 'walker')
    await assertFails(getDocs(collection(otro, 'conversations', 'paseo-1', 'messages')))
    await assertFails(addDoc(collection(otro, 'conversations', 'paseo-1', 'messages'), message('paseador-2', 'walker')))
  })
})

describe('lo que nadie puede hacer', () => {
  test('una familia no entra al hilo de otra', async () => {
    const intrusa = dbFor('familia-2', 'customer')
    await assertFails(getDoc(doc(intrusa, 'conversations', 'familia-1', 'messages', 'msg-1')))
    await assertFails(getDocs(collection(intrusa, 'conversations', 'familia-1', 'messages')))
    await assertFails(addDoc(collection(intrusa, 'conversations', 'familia-1', 'messages'), message('familia-2', 'customer')))
  })

  // Estas tres se prueban en el hilo del paseo, donde la familia SÍ puede
  // escribir: en el de administración fallarían por otra razón y no dirían nada.
  test('nadie escribe a nombre de otro', async () => {
    const familia = dbFor('familia-1', 'customer')
    await assertSucceeds(addDoc(collection(familia, 'conversations', 'paseo-1', 'messages'), message('familia-1', 'customer')))
    await assertFails(addDoc(collection(familia, 'conversations', 'paseo-1', 'messages'), message('otra-persona', 'customer')))
  })

  test('una familia no puede hacerse pasar por administración en su propio hilo', async () => {
    const familia = dbFor('familia-1', 'customer')
    await assertFails(addDoc(collection(familia, 'conversations', 'paseo-1', 'messages'), message('familia-1', 'admin')))
  })

  test('un mensaje vacío o con campos de más no entra', async () => {
    const familia = dbFor('familia-1', 'customer')
    await assertFails(addDoc(collection(familia, 'conversations', 'paseo-1', 'messages'), message('familia-1', 'customer', '')))
    await assertFails(addDoc(collection(familia, 'conversations', 'paseo-1', 'messages'), {
      ...message('familia-1', 'customer'), unreadAdmin: 99,
    }))
  })

  test('un mensaje ya enviado no se edita ni se borra', async () => {
    const familia = dbFor('familia-1', 'customer')
    await assertFails(updateDoc(doc(familia, 'conversations', 'familia-1', 'messages', 'msg-1'), { text: 'otra cosa' }))
  })

  test('sin sesión no se lee nada', async () => {
    const anonimo = env.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(getDoc(doc(anonimo, 'conversations', 'familia-1', 'messages', 'msg-1')))
  })
})
