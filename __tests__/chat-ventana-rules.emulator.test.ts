/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'

/**
 * El hilo de un paseo está abierto dos horas antes y hasta tres después de su
 * hora. Fuera de eso no se escribe: el chat es para ese paseo, no un canal
 * permanente entre una familia y un paseador.
 *
 * El reloj no se puede fingir aquí -- los temporizadores falsos rompen al SDK,
 * que los usa para hablar con el emulador --, así que lo que se mueve es la
 * hora del paseo: cada caso crea su hilo con la hora que le toca respecto a
 * ahora. Eso además prueba la conversión de zona horaria de verdad.
 */

const PROJECT_ID = 'demo-pet-chat-window'
/** La app guarda la hora del negocio: Ciudad de México, UTC-6 todo el año. */
const MEXICO_OFFSET_MS = 6 * 60 * 60_000
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

/** Fecha y hora, en la zona del negocio, de un momento a `minutes` de ahora. */
function businessClock(minutes: number): { date: string; start: string } {
  const local = new Date(Date.now() - MEXICO_OFFSET_MS + minutes * 60_000)
  return {
    date: local.toISOString().slice(0, 10),
    start: local.toISOString().slice(11, 16),
  }
}

async function walkThread(id: string, minutesFromNow: number) {
  const { date, start } = businessClock(minutesFromNow)
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    await setDoc(doc(db, 'conversations', id), {
      participants: ['customer-1', 'walker-1'],
      kind: 'walk',
      sessionId: id,
      customerId: 'customer-1',
      walkerId: 'walker-1',
      scheduledDate: date,
      scheduledStart: start,
    })
  })
}

const message = (uid: string, role: string) => ({
  text: 'Voy en camino', senderId: uid, senderRole: role, timestamp: serverTimestamp(),
})

const write = (id: string, uid: string, role?: string) =>
  addDoc(collection(dbFor(uid, role), 'conversations', id, 'messages'), message(uid, role ?? 'customer'))

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
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active' })
    await setDoc(doc(db, 'conversations', 'soporte'), {
      participants: ['customer-1'], kind: 'support', customerId: 'customer-1',
    })
  })
})

afterAll(async () => env.cleanup())

describe('la ventana del chat de un paseo', () => {
  test('abierta: el paseo es ahora, o en hora y media, o empezó hace una hora', async () => {
    await walkThread('ahora', 0)
    await walkThread('pronto', 90)
    await walkThread('recien', -60)
    await assertSucceeds(write('ahora', 'customer-1'))
    await assertSucceeds(write('pronto', 'walker-1', 'walker'))
    await assertSucceeds(write('recien', 'customer-1'))
  })

  test('cerrada antes: faltan más de dos horas', async () => {
    await walkThread('lejos', 200)
    await walkThread('manana', 24 * 60)
    await assertFails(write('lejos', 'customer-1'))
    await assertFails(write('manana', 'walker-1', 'walker'))
  })

  test('cerrada después: pasaron más de tres horas', async () => {
    await walkThread('viejo', -200)
    await walkThread('ayer', -24 * 60)
    await assertFails(write('viejo', 'customer-1'))
    await assertFails(write('ayer', 'walker-1', 'walker'))
  })

  test('administración escribe a cualquier hora: es quien atiende un problema', async () => {
    await walkThread('viejo', -24 * 60)
    await assertSucceeds(addDoc(collection(dbFor('admin-1', 'admin'), 'conversations', 'viejo', 'messages'), message('admin-1', 'admin')))
  })

  test('un hilo que no es de un paseo no tiene ventana', async () => {
    await assertSucceeds(addDoc(collection(dbFor('customer-1'), 'conversations', 'soporte', 'messages'), message('customer-1', 'customer')))
  })

  test('alguien ajeno no escribe, ni con la ventana abierta', async () => {
    await walkThread('ahora', 0)
    await assertFails(write('ahora', 'customer-2'))
  })

  test('leer lo escrito sigue siendo posible fuera de la ventana', async () => {
    await walkThread('viejo', -24 * 60)
    const { getDocs } = await import('firebase/firestore')
    await assertSucceeds(getDocs(collection(dbFor('customer-1'), 'conversations', 'viejo', 'messages')))
  })
})
