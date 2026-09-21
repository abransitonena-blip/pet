/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore'

/**
 * El hilo de un paseo está abierto dos horas antes y hasta tres después de su
 * hora. Fuera de eso no se escribe: el chat es para ese paseo, no un canal
 * permanente entre una familia y un paseador. Y una familia sólo le escribe a
 * su paseador, nunca a administración.
 *
 * La hora que cuenta es la de la SESIÓN del paseo, que ni la familia ni el
 * paseador pueden escribir. La primera versión leía la hora del propio hilo, y
 * cualquiera de los dos participantes podía editarla para reabrirlo cuando
 * quisiera: una ventana que se abre con una línea de código no limita nada.
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

/**
 * Un paseo y su hilo. La hora vive en la sesión; el hilo lleva una copia, que
 * es justo la que no debe valer.
 */
async function walkThread(
  id: string,
  minutesFromNow: number,
  options: { walkerId?: string; participants?: string[]; threadClock?: { date: string; start: string } | null; customerId?: string } = {},
) {
  const { date, start } = businessClock(minutesFromNow)
  const walkerId = options.walkerId ?? 'walker-1'
  const customerId = options.customerId ?? 'customer-1'
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    await setDoc(doc(db, 'walkSessions', id), {
      customerId, walkerId, scheduledDate: date, scheduledStart: start, status: 'assigned',
    })
    const copy = options.threadClock === undefined ? { date, start } : options.threadClock
    await setDoc(doc(db, 'conversations', id), {
      participants: options.participants ?? [customerId, walkerId].filter(Boolean),
      kind: 'walk',
      sessionId: id,
      customerId,
      walkerId,
      ...(copy ? { scheduledDate: copy.date, scheduledStart: copy.start } : {}),
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

  test('el hilo de administración con un paseador no tiene ventana', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(doc(db, 'conversations', 'walker-1'), { participants: ['walker-1'], customerId: 'walker-1', participantRole: 'walker' })
    })
    await assertSucceeds(addDoc(collection(dbFor('walker-1', 'walker'), 'conversations', 'walker-1', 'messages'), message('walker-1', 'walker')))
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

/**
 * "El de cliente no puede enviar a admin, sólo al paseador." La pantalla ya no
 * lo ofrece, pero una pantalla no es una regla: quien abriera la consola del
 * navegador seguía pudiendo escribirle a administración por el hilo de siempre.
 */
describe('la familia sólo le escribe a su paseador', () => {
  test('el hilo de siempre con administración ya no admite mensajes de una familia', async () => {
    await assertFails(addDoc(collection(dbFor('customer-1'), 'conversations', 'soporte', 'messages'), message('customer-1', 'customer')))
  })

  test('tampoco se abre un hilo nuevo con administración', async () => {
    await assertFails(setDoc(doc(dbFor('customer-1'), 'conversations', 'nuevo'), {
      participants: ['customer-1'], customerId: 'customer-1', participantRole: 'customer',
    }))
  })

  test('sin claims de rol la familia sigue siendo familia', async () => {
    await assertFails(addDoc(collection(dbFor('customer-1', 'client'), 'conversations', 'soporte', 'messages'), message('customer-1', 'customer')))
  })

  test('lo que ya se escribió con administración se sigue leyendo', async () => {
    const { getDocs } = await import('firebase/firestore')
    await assertSucceeds(getDocs(collection(dbFor('customer-1'), 'conversations', 'soporte', 'messages')))
  })

  test('el hilo de su propio paseo sí se puede abrir, y ahí escribe', async () => {
    const { date, start } = businessClock(0)
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(doc(db, 'walkSessions', 'paseo-nuevo'), {
        customerId: 'customer-1', walkerId: 'walker-1', scheduledDate: date, scheduledStart: start, status: 'assigned',
      })
    })
    await assertSucceeds(setDoc(doc(dbFor('customer-1'), 'conversations', 'paseo-nuevo'), {
      participants: ['customer-1', 'walker-1'], kind: 'walk', sessionId: 'paseo-nuevo', customerId: 'customer-1', walkerId: 'walker-1',
      scheduledDate: date, scheduledStart: start, participantRole: 'walk',
    }))
    await assertSucceeds(write('paseo-nuevo', 'customer-1'))
  })

  test('no se abre el hilo de un paseo ajeno', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(doc(db, 'walkSessions', 'paseo-ajeno'), {
        customerId: 'customer-2', walkerId: 'walker-1', scheduledDate: businessClock(0).date, scheduledStart: businessClock(0).start, status: 'assigned',
      })
    })
    await assertFails(setDoc(doc(dbFor('customer-1'), 'conversations', 'paseo-ajeno'), {
      participants: ['customer-1', 'walker-1'], kind: 'walk', sessionId: 'paseo-ajeno', customerId: 'customer-1', walkerId: 'walker-1',
    }))
  })

  test('un hilo de paseo sin el paseador entre los participantes no lleva mensajes de la familia', async () => {
    // Ese hilo sólo lo leería administración: sería escribirle a administración por otra puerta.
    await walkThread('solo-familia', 0, { participants: ['customer-1'] })
    await assertFails(write('solo-familia', 'customer-1'))
  })

  test('un paseo sin paseador asignado no tiene hilo abierto', async () => {
    await walkThread('sin-paseador', 0, { walkerId: '' })
    await assertFails(write('sin-paseador', 'customer-1'))
  })
})

describe('la hora es la del paseo, no la que diga el hilo', () => {
  test('editar la hora del hilo no lo reabre', async () => {
    await walkThread('viejo', -24 * 60)
    const now = businessClock(0)
    // Con o sin permiso para editar, el mensaje no puede pasar.
    await updateDoc(doc(dbFor('customer-1'), 'conversations', 'viejo'), {
      scheduledDate: now.date, scheduledStart: now.start,
    }).catch(() => undefined)
    await assertFails(write('viejo', 'customer-1'))
    await updateDoc(doc(dbFor('walker-1', 'walker'), 'conversations', 'viejo'), {
      scheduledDate: now.date, scheduledStart: now.start,
    }).catch(() => undefined)
    await assertFails(write('viejo', 'walker-1', 'walker'))
  })

  test('un hilo sin hora copiada tampoco se abre solo', async () => {
    await walkThread('sin-copia', -24 * 60, { threadClock: null })
    await assertFails(write('sin-copia', 'customer-1'))
    await assertFails(write('sin-copia', 'walker-1', 'walker'))
  })

  test('no se le quita el "kind" al hilo para escapar de la ventana', async () => {
    await walkThread('viejo', -24 * 60)
    await assertFails(updateDoc(doc(dbFor('customer-1'), 'conversations', 'viejo'), { kind: 'support' }))
    await assertFails(updateDoc(doc(dbFor('walker-1', 'walker'), 'conversations', 'viejo'), { kind: 'support' }))
  })

  test('si el paseo se mueve, el hilo sigue al paseo', async () => {
    // El paseo estaba hoy y la familia lo pasó a mañana: el hilo se cierra sin tocarlo.
    await walkThread('movido', 0)
    await assertSucceeds(write('movido', 'customer-1'))
    const tomorrow = businessClock(24 * 60)
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await updateDoc(doc(db, 'walkSessions', 'movido'), { scheduledDate: tomorrow.date, scheduledStart: tomorrow.start })
    })
    await assertFails(write('movido', 'customer-1'))
  })
})
