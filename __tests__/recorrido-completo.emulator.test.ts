/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  addDoc, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, type Firestore,
} from 'firebase/firestore'
import { actor } from './helpers/actor-firebase'

// La app pide `db` y `auth` a estos módulos. Se sustituyen por los del emulador
// y por quien la prueba ponga en sesión (ver helpers/actor-firebase.ts).
jest.mock('@/firebase/db', () => jest.requireActual('./helpers/actor-firebase').dbModule)
jest.mock('@/firebase/config', () => jest.requireActual('./helpers/actor-firebase').configModule)
// Los avisos al teléfono son de otro sistema; aquí sólo importa que no estorben.
jest.mock('@/lib/push/pushClient', () => ({ notifySessionEvent: jest.fn(), notifyChatMessage: jest.fn() }))

import { submitReservation } from '@/lib/submitReservation'
import { assignCanonicalWalkSession } from '@/lib/useCanonicalWalkSessions'
import { advanceWalkerSession } from '@/lib/useServiceOrders'
import { cancelOwnWalk, rescheduleOwnWalk } from '@/lib/familyCancellation'
import { openWalkConversation, sendChatMessage } from '@/lib/chat'
import { buildWalkerReview } from '@/lib/walkerReviews'
import { BOOKING_DAY_KEYS, buildBookingSlots, createEmptyBookingSchedule } from '@/lib/bookingSchedule'
import type { WalkSession } from '@/types'

/**
 * El recorrido de un paseo, de punta a punta, con cada persona en su sesión.
 *
 * Los paneles fallaron en producción semanas porque cada pantalla se probaba por
 * su lado y nadie caminaba el paseo entero: la consulta de administración pedía
 * 600 perros donde la regla permite 100, y no había una sola prueba que la
 * hiciera como administración. Aquí la familia pide, administración asigna, el
 * paseador avanza y termina, la familia califica y se escriben -- todo con las
 * funciones reales de la app contra las reglas reales.
 *
 * Es un recorrido: las pruebas se ejecutan en orden y cada una sigue donde la
 * anterior lo dejó.
 */

const PROJECT_ID = 'demo-pet-journey'
const MEXICO_OFFSET_MS = 6 * 60 * 60_000
let env: RulesTestEnvironment

/** Pone a `uid` en sesión con su rol, como el inicio de sesión real. */
function as(uid: string, role?: string): Firestore {
  const db = env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
  actor.db = db
  actor.uid = uid
  return db
}

const admin = () => as('admin-1', 'admin')
const family = () => as('customer-1')
const walker = (uid = 'walker-1') => as(uid, 'walker')

function businessClock(minutes: number): { date: string; start: string } {
  const local = new Date(Date.now() - MEXICO_OFFSET_MS + minutes * 60_000)
  return { date: local.toISOString().slice(0, 10), start: local.toISOString().slice(11, 16) }
}

/** El paseo, tal como está guardado, para los pasos que necesitan verlo. */
async function stored(sessionId: string) {
  let data: Record<string, unknown> = {}
  await env.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(doc(context.firestore() as unknown as Firestore, 'walkSessions', sessionId))
    data = snapshot.data() ?? {}
  })
  return data
}

/** Mueve el paseo a un momento relativo a ahora (lo que hace pasar "el día del paseo"). */
async function moveWalk(sessionId: string, minutesFromNow: number) {
  const { date, start } = businessClock(minutesFromNow)
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore() as unknown as Firestore, 'walkSessions', sessionId), {
      scheduledDate: date, scheduledStart: start, arrivalWindowStart: start,
    })
  })
}

async function sessionIdsOf(customerId: string): Promise<string[]> {
  const ids: string[] = []
  await env.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDocs(query(collection(context.firestore() as unknown as Firestore, 'walkSessions'), where('customerId', '==', customerId)))
    snapshot.forEach((item) => ids.push(item.id))
  })
  return ids
}

/** Un día de dentro de tres días y su primer horario libre, como lo ofrecería el formulario. */
function bookableSlot(schedule: ReturnType<typeof createEmptyBookingSchedule>) {
  const date = businessClock(3 * 24 * 60).date
  const slot = buildBookingSlots(schedule, date, 60)[0]
  if (!slot) throw new Error('la prueba no encontró un horario reservable')
  return { date, time: `${slot.start}-${slot.end}` }
}

const form = (date: string, time: string) => ({
  name: 'Familia Pérez', phone: '5512345678', petId: 'dog-1', petName: 'Rocco', petType: 'perro',
  serviceId: 'paseo-individual', serviceName: 'Paseo individual', servicePackageType: 'individual' as const,
  serviceVersion: 1, serviceDurationMinutes: 60, zoneId: 'zone-1', date, time, notes: '',
  coupon: '', addressId: 'address-1', walkerPreference: '',
})

const request = (date: string, time: string) => submitReservation({
  form: form(date, time), couponStatus: null, referralCode: '', walkerPreference: '', availableWalkers: [], selectedAddressId: 'address-1',
})

const scheduleDoc = () => {
  const empty = createEmptyBookingSchedule()
  return {
    ...empty,
    active: true,
    version: 1,
    updatedBy: 'admin-1',
    weeklyHours: Object.fromEntries(BOOKING_DAY_KEYS.map((day) => [day, { enabled: true, open: '06:00', close: '21:00' }])) as typeof empty.weeklyHours,
  }
}

beforeAll(async () => {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST?.split(':')
  const rulesPath = process.env.FIRESTORE_RULES_PATH
  if (!hostPort?.[0] || !hostPort[1] || !rulesPath) throw new Error('FIRESTORE_EMULATOR_HOST and FIRESTORE_RULES_PATH are required')
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: hostPort[0], port: Number(hostPort[1]), rules: readFileSync(rulesPath, 'utf8') },
  })
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    await setDoc(doc(db, 'appSettings', 'bookingSchedule'), { ...scheduleDoc(), updatedAt: serverTimestamp() })
    await setDoc(doc(db, 'zones', 'zone-1'), { name: 'Roma Norte', active: true })
    // Las reglas sólo dejan pedir un servicio con tarifa publicada.
    await setDoc(doc(db, 'appSettings', 'servicePrices'), {
      services: {
        'paseo-individual': {
          id: 'paseo-individual', name: 'Paseo individual', amountCents: 3000,
          currency: 'MXN', active: true, complimentary: false, version: 1,
        },
      },
    })
    await setDoc(doc(db, 'dogs', 'dog-1'), { ownerId: 'customer-1', name: 'Rocco', breed: 'Mestizo' })
    await setDoc(doc(db, 'addresses', 'address-1'), { ownerId: 'customer-1', zoneId: 'zone-1', street: 'Calle 1' })
    for (const uid of ['walker-1', 'walker-2']) await setDoc(doc(db, 'walkerProfiles', uid), { status: 'active', name: uid })
  })
})

afterAll(async () => env.cleanup())

let sessionId = ''

describe('el recorrido de un paseo', () => {
  test('1. la familia pide un paseo, con la función real de la app', async () => {
    family()
    const { date, time } = bookableSlot(scheduleDoc())
    await request(date, time)

    const ids = await sessionIdsOf('customer-1')
    expect(ids).toHaveLength(1)
    sessionId = ids[0]
    const session = await stored(sessionId)
    expect(session.status).toBe('requested')
    expect(session.customerId).toBe('customer-1')
    expect(session.walkerId ?? '').toBe('')
  })

  test('2. la solicitud es de ella: otra familia no la ve, y ningún paseador se la puede adueñar', async () => {
    await assertSucceeds(getDoc(doc(family(), 'walkSessions', sessionId)))
    await assertFails(getDoc(doc(as('customer-2'), 'walkSessions', sessionId)))
    // Ni la familia se asigna un paseador, ni un paseador se asigna solo.
    await assertFails(updateDoc(doc(family(), 'walkSessions', sessionId), { status: 'assigned', walkerId: 'walker-1' }))
    await assertFails(updateDoc(doc(walker(), 'walkSessions', sessionId), { status: 'assigned', walkerId: 'walker-1' }))
  })

  test('3. administración asigna al paseador, con la función real', async () => {
    admin()
    await assignCanonicalWalkSession(sessionId, 'walker-1')
    const session = await stored(sessionId)
    expect(session.status).toBe('assigned')
    expect(session.walkerId).toBe('walker-1')
    expect(session.assignedBy).toBe('admin-1')
  })

  test('4. el paseador de ese paseo lo ve; el de otro no', async () => {
    await assertSucceeds(getDoc(doc(walker('walker-1'), 'walkSessions', sessionId)))
    await assertFails(getDoc(doc(walker('walker-2'), 'walkSessions', sessionId)))
  })

  test('5. llega el día: familia y paseador se escriben en el hilo del paseo', async () => {
    await moveWalk(sessionId, 0)

    family()
    const familyThread = await openWalkConversation({
      sessionId, customerId: 'customer-1', customerName: 'Familia Pérez', walkerId: 'walker-1', walkerName: 'Ana',
      ...(() => { const { date, start } = businessClock(0); return { scheduledDate: date, scheduledStart: start } })(),
    })
    expect(familyThread).toBe(sessionId)
    await sendChatMessage(sessionId, { text: '¿Ya vienen por Rocco?', senderId: 'customer-1', senderRole: 'customer' }, { walkThread: true })

    walker('walker-1')
    await openWalkConversation({
      sessionId, customerId: 'customer-1', customerName: 'Familia de Rocco', walkerId: 'walker-1', walkerName: 'Ana',
      ...(() => { const { date, start } = businessClock(0); return { scheduledDate: date, scheduledStart: start } })(),
    })
    await sendChatMessage(sessionId, { text: 'Voy en camino', senderId: 'walker-1', senderRole: 'walker' }, { walkThread: true })

    // Administración lo puede leer, pero no es parte de la conversación.
    await assertSucceeds(getDocs(collection(admin(), 'conversations', sessionId, 'messages')))
    // Nadie más entra.
    await assertFails(getDocs(collection(as('customer-2'), 'conversations', sessionId, 'messages')))
    await assertFails(getDocs(collection(walker('walker-2'), 'conversations', sessionId, 'messages')))
  })

  test('6. la familia no puede escribirle a administración, ni por la puerta de siempre', async () => {
    const db = family()
    await assertFails(addDoc(collection(db, 'conversations', 'customer-1', 'messages'), {
      text: 'Hola admin', senderId: 'customer-1', senderRole: 'customer', timestamp: serverTimestamp(),
    }))
    await assertFails(setDoc(doc(db, 'conversations', 'customer-1'), { participants: ['customer-1'], participantRole: 'customer' }))
  })

  test('7. el paseador avanza el paseo paso a paso, con la función real, hasta terminarlo', async () => {
    walker('walker-1')
    const expected = ['confirmed', 'on_the_way', 'arrived', 'in_progress', 'completed']
    for (const status of expected) {
      const current = await stored(sessionId)
      await advanceWalkerSession({ id: sessionId, ...current } as unknown as WalkSession)
      expect((await stored(sessionId)).status).toBe(status)
    }
  })

  test('8. otro paseador, o la familia, no pueden mover un paseo que no es suyo', async () => {
    // Ya terminado, y aun así: nadie más puede reescribir su historia.
    await assertFails(updateDoc(doc(walker('walker-2'), 'walkSessions', sessionId), { status: 'in_progress' }))
    await assertFails(updateDoc(doc(family(), 'walkSessions', sessionId), { status: 'cancelled' }))
  })

  test('9. terminado el paseo, la familia lo califica, una sola vez', async () => {
    const db = family()
    const review = () => ({
      ...buildWalkerReview({ sessionId, walkerId: 'walker-1', customerId: 'customer-1', rating: 5, text: 'Muy puntual' }),
      createdAt: serverTimestamp(),
    })
    await assertSucceeds(setDoc(doc(db, 'walkerReviews', sessionId), review()))
    await assertFails(setDoc(doc(db, 'walkerReviews', sessionId), { ...review(), rating: 1 }))
    // Otra familia no califica un paseo que no vivió.
    await assertFails(setDoc(doc(as('customer-2'), 'walkerReviews', sessionId), {
      ...buildWalkerReview({ sessionId, walkerId: 'walker-1', customerId: 'customer-2', rating: 1, text: '' }),
      createdAt: serverTimestamp(),
    }))
  })

  test('10. el paseador ve lo que dijeron de él; otro paseador no', async () => {
    await assertSucceeds(getDocs(query(collection(walker('walker-1'), 'walkerReviews'), where('walkerId', '==', 'walker-1'), limit(100))))
    await assertFails(getDocs(query(collection(walker('walker-2'), 'walkerReviews'), where('walkerId', '==', 'walker-1'), limit(100))))
  })

  test('11. pasada la ventana, el hilo se lee pero ya no se escribe', async () => {
    await moveWalk(sessionId, -24 * 60)
    await assertSucceeds(getDocs(collection(family(), 'conversations', sessionId, 'messages')))
    await assertFails(addDoc(collection(family(), 'conversations', sessionId, 'messages'), {
      text: '¿Sigues ahí?', senderId: 'customer-1', senderRole: 'customer', timestamp: serverTimestamp(),
    }))
  })
})

describe('cuando el paseo no sale como se pidió', () => {
  let second = ''

  test('la familia pide otro y administración lo asigna', async () => {
    family()
    const { date, time } = bookableSlot(scheduleDoc())
    await request(date, time)
    second = (await sessionIdsOf('customer-1')).find((id) => id !== sessionId) ?? ''
    expect(second).not.toBe('')
    admin()
    await assignCanonicalWalkSession(second, 'walker-1')
    expect((await stored(second)).status).toBe('assigned')
  })

  test('la familia lo mueve: el paseo vuelve a la cola sin paseador', async () => {
    family()
    const result = await rescheduleOwnWalk({
      sessionId: second, uid: 'customer-1', status: 'assigned', date: businessClock(5 * 24 * 60).date, start: '09:00', end: '10:00',
    })
    expect(result).toEqual({ ok: true })
    const session = await stored(second)
    expect(session.status).toBe('requested')
    expect(session.walkerId).toBe('')
  })

  test('la familia lo cancela mientras nadie haya salido', async () => {
    family()
    expect(await cancelOwnWalk({ sessionId: second, uid: 'customer-1', status: 'requested', reason: 'Nos salió un viaje' })).toEqual({ ok: true })
    expect((await stored(second)).status).toBe('cancelled')
  })

  test('no se cancela ni se mueve un paseo que ya salió', async () => {
    // El primero terminó: la pantalla ni lo ofrece, y las reglas tampoco lo dejarían.
    family()
    expect(await cancelOwnWalk({ sessionId, uid: 'customer-1', status: 'completed' })).toEqual({ ok: false, reason: 'too-late' })
    await assertFails(updateDoc(doc(family(), 'walkSessions', sessionId), { status: 'cancelled', cancelledBy: 'customer-1' }))
  })
})
