/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore'

/**
 * Cuando un paseo cambia de paseador -- o la familia lo mueve y el paseador se
 * suelta --, el hilo lo guarda con la lista de participantes que tenía. Esa lista
 * se refresca cuando alguien abre el hilo, pero mientras tanto:
 *
 * - el paseador NUEVO no estaba en ella, así que no podía ni abrirlo (para
 *   refrescarla hay que escribir el hilo, y las reglas pedían ya estar en la
 *   lista: un círculo);
 * - el paseador ANTERIOR seguía en ella, y leía la conversación de una familia
 *   que ya no es la suya.
 *
 * La pertenencia a un hilo de paseo tiene que salir de la sesión, que es lo que
 * de verdad dice quién lleva el paseo hoy.
 */

const PROJECT_ID = 'demo-pet-chat-reassign'
const MEXICO_OFFSET_MS = 6 * 60 * 60_000
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

function businessClock(minutes: number): { date: string; start: string } {
  const local = new Date(Date.now() - MEXICO_OFFSET_MS + minutes * 60_000)
  return { date: local.toISOString().slice(0, 10), start: local.toISOString().slice(11, 16) }
}

const message = (uid: string, role: string) => ({ text: 'Hola', senderId: uid, senderRole: role, timestamp: serverTimestamp() })

/** Un paseo abierto ahora que YA es de `sessionWalker`, con un hilo que aún lista a `threadWalker`. */
async function reassigned(id: string, sessionWalker: string, threadWalker: string) {
  const now = businessClock(0)
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    await setDoc(doc(db, 'walkSessions', id), {
      customerId: 'customer-1', walkerId: sessionWalker, scheduledDate: now.date, scheduledStart: now.start, status: 'assigned',
    })
    await setDoc(doc(db, 'conversations', id), {
      participants: ['customer-1', threadWalker], kind: 'walk', sessionId: id, customerId: 'customer-1', walkerId: threadWalker,
      lastMessage: 'Ya voy para allá',
    })
    await setDoc(doc(db, 'conversations', id, 'messages', 'm1'), {
      text: 'Ya voy para allá', senderId: threadWalker, senderRole: 'walker', timestamp: serverTimestamp(),
    })
  })
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
    for (const walker of ['walker-old', 'walker-new']) await setDoc(doc(db, 'walkerProfiles', walker), { status: 'active' })
  })
})

afterAll(async () => env.cleanup())

describe('el paseador nuevo de un paseo reasignado', () => {
  test('abre el hilo -- lo que hace la app al entrar -- y escribe', async () => {
    await reassigned('paseo', 'walker-new', 'walker-old')
    const nuevo = dbFor('walker-new', 'walker')
    // Es exactamente lo que hace openWalkConversation: un merge con la lista al día.
    await assertSucceeds(setDoc(doc(nuevo, 'conversations', 'paseo'), {
      participants: ['customer-1', 'walker-new'], kind: 'walk', sessionId: 'paseo', customerId: 'customer-1', walkerId: 'walker-new',
      updatedAt: serverTimestamp(),
    }, { merge: true }))
    await assertSucceeds(addDoc(collection(nuevo, 'conversations', 'paseo', 'messages'), message('walker-new', 'walker')))
  })

  test('lee lo escrito aunque el hilo aún no lo incluya', async () => {
    await reassigned('paseo', 'walker-new', 'walker-old')
    await assertSucceeds(getDocs(collection(dbFor('walker-new', 'walker'), 'conversations', 'paseo', 'messages')))
  })

  test('la familia lo refresca igual al abrir el suyo', async () => {
    await reassigned('paseo', 'walker-new', 'walker-old')
    await assertSucceeds(setDoc(doc(dbFor('customer-1'), 'conversations', 'paseo'), {
      participants: ['customer-1', 'walker-new'], kind: 'walk', walkerId: 'walker-new',
    }, { merge: true }))
    await assertSucceeds(addDoc(collection(dbFor('walker-new', 'walker'), 'conversations', 'paseo', 'messages'), message('walker-new', 'walker')))
  })
})

describe('el paseador anterior', () => {
  test('ya no lee la conversación ni sus mensajes, aunque el hilo todavía lo liste', async () => {
    await reassigned('paseo', 'walker-new', 'walker-old')
    const anterior = dbFor('walker-old', 'walker')
    await assertFails(getDocs(collection(anterior, 'conversations', 'paseo', 'messages')))
    await assertFails(getDoc(doc(anterior, 'conversations', 'paseo')))
  })

  test('tampoco escribe ni cambia el hilo', async () => {
    await reassigned('paseo', 'walker-new', 'walker-old')
    const anterior = dbFor('walker-old', 'walker')
    await assertFails(addDoc(collection(anterior, 'conversations', 'paseo', 'messages'), message('walker-old', 'walker')))
    await assertFails(updateDoc(doc(anterior, 'conversations', 'paseo'), { participants: ['walker-old'] }))
  })

  test('si la familia movió el paseo y se soltó al paseador, deja de ver el hilo', async () => {
    await reassigned('paseo', '', 'walker-old')
    await assertFails(getDocs(collection(dbFor('walker-old', 'walker'), 'conversations', 'paseo', 'messages')))
  })
})

describe('lo que no cambia', () => {
  test('la familia sigue leyendo su hilo, y administración cualquiera', async () => {
    await reassigned('paseo', 'walker-new', 'walker-old')
    await assertSucceeds(getDocs(collection(dbFor('customer-1'), 'conversations', 'paseo', 'messages')))
    await assertSucceeds(getDoc(doc(dbFor('customer-1'), 'conversations', 'paseo')))
    await assertSucceeds(getDocs(collection(dbFor('admin-1', 'admin'), 'conversations', 'paseo', 'messages')))
  })

  test('cada lado apaga su propio "sin leer" en el hilo del paseo', async () => {
    await reassigned('paseo', 'walker-new', 'walker-new')
    await assertSucceeds(updateDoc(doc(dbFor('customer-1'), 'conversations', 'paseo'), { unreadClient: 0 }))
    await assertSucceeds(updateDoc(doc(dbFor('walker-new', 'walker'), 'conversations', 'paseo'), { unreadWalker: 0 }))
    await assertFails(updateDoc(doc(dbFor('customer-2'), 'conversations', 'paseo'), { unreadWalker: 99 }))
  })

  test('otra familia o un paseador ajeno siguen sin entrar', async () => {
    await reassigned('paseo', 'walker-new', 'walker-old')
    await assertFails(getDocs(collection(dbFor('customer-2'), 'conversations', 'paseo', 'messages')))
    await assertFails(getDocs(collection(dbFor('walker-3', 'walker'), 'conversations', 'paseo', 'messages')))
  })

  test('el hilo de un paseador con administración sigue siendo de quien lo lista', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(doc(db, 'conversations', 'walker-new'), { participants: ['walker-new'], customerId: 'walker-new', participantRole: 'walker' })
    })
    await assertSucceeds(getDoc(doc(dbFor('walker-new', 'walker'), 'conversations', 'walker-new')))
    await assertSucceeds(addDoc(collection(dbFor('walker-new', 'walker'), 'conversations', 'walker-new', 'messages'), message('walker-new', 'walker')))
    await assertFails(getDoc(doc(dbFor('walker-old', 'walker'), 'conversations', 'walker-new')))
  })
})
