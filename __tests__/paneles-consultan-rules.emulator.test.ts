/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection, doc, getDocs, limit, orderBy, query, setDoc, startAfter, where, Timestamp, type Firestore,
} from 'firebase/firestore'

/**
 * Las consultas que hace cada panel, contra las reglas de verdad.
 *
 * Esta es la prueba que faltaba. Perros, Familias e Insights estuvieron rotos
 * meses -- "tu sesión no tiene permiso" y cero resultados -- porque el
 * directorio pedía 600 perros donde la regla permite 100. Ninguna prueba lo vio
 * porque ninguna listaba como admin contra las reglas reales: se probaba el
 * código por dentro, no la conversación con Firestore.
 *
 * Cada caso de aquí copia la consulta que hace un gancho real. Si alguien
 * cambia un límite, un orden o un filtro de forma que la regla ya no lo acepte,
 * esto falla antes de llegar a producción.
 */

const PROJECT_ID = 'demo-pet-panels'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
const TODAY = '2026-10-02'
const MONTH_START = '2026-10-01'
const MONTH_END = '2026-10-31'
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
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active', name: 'Ana', zones: ['centro'], maxDaily: 4 })
    await setDoc(doc(db, 'customerProfiles', 'customer-1'), { name: 'Familia Uno', phone: '5555555555' })
    await setDoc(doc(db, 'dogs', 'dog-1'), { ownerId: 'customer-1', name: 'Luna' })
    await setDoc(doc(db, 'addresses', 'address-1'), { ownerId: 'customer-1', zoneId: 'centro', street: 'Calle 1' })
    await setDoc(doc(db, 'zones', 'centro'), { name: 'Centro', active: true, postalCodes: ['06700'] })
    await setDoc(doc(db, 'walkSessions', 'session-1'), {
      orderId: 'order-1', customerId: 'customer-1', dogIds: ['dog-1'], addressId: 'address-1',
      serviceId: 'paseo-individual', serviceVersion: 1, scheduledDate: TODAY, scheduledStart: '10:00',
      arrivalWindowStart: '10:00', arrivalWindowEnd: '10:20', walkerId: 'walker-1', status: 'completed', createdAt: NOW,
    })
    await setDoc(doc(db, 'walkReports', 'session-1'), {
      walkSessionId: 'session-1', orderId: 'order-1', customerId: 'customer-1', walkerId: 'walker-1',
      dogIds: ['dog-1'], status: 'submitted', summary: 'Todo bien', behaviorNotes: '', bathroomNotes: '',
      waterProvided: true, incidentsSummary: '', mediaReferences: [], createdBy: 'walker-1',
      createdAt: NOW, updatedAt: NOW, submittedAt: NOW, schemaVersion: 1,
    })
  })
})

afterAll(async () => env.cleanup())

describe('el panel de administración', () => {
  test('el directorio: perros de cien en cien y perfiles de familia', async () => {
    const db = dbFor('admin-1', 'admin')
    const first = await assertSucceeds(getDocs(query(collection(db, 'dogs'), limit(100))))
    if (first.docs.length > 0) {
      await assertSucceeds(getDocs(query(collection(db, 'dogs'), startAfter(first.docs[first.docs.length - 1]), limit(100))))
    }
    await assertSucceeds(getDocs(query(collection(db, 'customerProfiles'), limit(300))))
  })

  test('los paseos: la página del historial y la cola de solicitudes', async () => {
    const db = dbFor('admin-1', 'admin')
    // useCanonicalReservations: página por fecha, descendente.
    await assertSucceeds(getDocs(query(collection(db, 'walkSessions'), orderBy('scheduledDate', 'desc'), limit(100))))
    // useRequestedWalkSessions: la cola por asignar.
    await assertSucceeds(getDocs(query(
      collection(db, 'walkSessions'),
      where('status', '==', 'requested'),
      orderBy('createdAt', 'asc'),
      limit(100),
    )))
    // useUpcomingAssignments: la carga de los próximos días.
    await assertSucceeds(getDocs(query(
      collection(db, 'walkSessions'),
      where('scheduledDate', '>=', TODAY),
      where('scheduledDate', '<=', MONTH_END),
      orderBy('scheduledDate', 'asc'),
      limit(100),
    )))
  })

  test('paseadores activos y zonas', async () => {
    const db = dbFor('admin-1', 'admin')
    await assertSucceeds(getDocs(query(collection(db, 'walkerProfiles'), where('status', '==', 'active'), limit(100))))
    await assertSucceeds(getDocs(query(collection(db, 'zones'), where('active', '==', true), limit(100))))
  })

  test('un supervisor ve lo mismo; una familia no ve el directorio', async () => {
    await assertSucceeds(getDocs(query(collection(dbFor('sup-1', 'supervisor'), 'walkSessions'), orderBy('scheduledDate', 'desc'), limit(100))))
    await assertFails(getDocs(query(collection(dbFor('customer-1'), 'dogs'), limit(100))))
    await assertFails(getDocs(query(collection(dbFor('customer-1'), 'customerProfiles'), limit(100))))
  })
})

describe('el panel del paseador', () => {
  test('su jornada: sus paseos desde una fecha, con tope', async () => {
    const db = dbFor('walker-1', 'walker')
    await assertSucceeds(getDocs(query(
      collection(db, 'walkSessions'),
      where('walkerId', '==', 'walker-1'),
      where('scheduledDate', '>=', MONTH_START),
      orderBy('scheduledDate', 'asc'),
      limit(100),
    )))
  })

  test('su historial: un mes cerrado', async () => {
    const db = dbFor('walker-1', 'walker')
    await assertSucceeds(getDocs(query(
      collection(db, 'walkSessions'),
      where('walkerId', '==', 'walker-1'),
      where('scheduledDate', '>=', MONTH_START),
      where('scheduledDate', '<=', MONTH_END),
      orderBy('scheduledDate', 'asc'),
      limit(100),
    )))
  })

  test('qué reportes suyos ya salieron', async () => {
    const db = dbFor('walker-1', 'walker')
    const reports = await assertSucceeds(getDocs(query(
      collection(db, 'walkReports'),
      where('walkerId', '==', 'walker-1'),
      where('walkSessionId', 'in', ['session-1']),
      limit(10),
    )))
    expect(reports.docs).toHaveLength(1)
  })

  test('no puede mirar los paseos de otro paseador', async () => {
    await assertFails(getDocs(query(
      collection(dbFor('walker-1', 'walker'), 'walkSessions'),
      where('walkerId', '==', 'walker-2'),
      orderBy('scheduledDate', 'asc'),
      limit(100),
    )))
  })
})

describe('el panel de la familia', () => {
  test('sus paseos, con la ventana que pide cada pantalla', async () => {
    const db = dbFor('customer-1')
    // Inicio e historial: un mes, o desde una fecha.
    await assertSucceeds(getDocs(query(
      collection(db, 'walkSessions'),
      where('customerId', '==', 'customer-1'),
      where('scheduledDate', '>=', MONTH_START),
      where('scheduledDate', '<=', MONTH_END),
      orderBy('scheduledDate', 'asc'),
      limit(100),
    )))
    await assertSucceeds(getDocs(query(
      collection(db, 'walkSessions'),
      where('customerId', '==', 'customer-1'),
      orderBy('scheduledDate', 'desc'),
      limit(100),
    )))
  })

  test('sus perros y sus direcciones', async () => {
    const db = dbFor('customer-1')
    await assertSucceeds(getDocs(query(collection(db, 'dogs'), where('ownerId', '==', 'customer-1'), limit(50))))
    await assertSucceeds(getDocs(query(collection(db, 'addresses'), where('ownerId', '==', 'customer-1'), limit(25))))
  })

  test('no puede pedir los paseos de otra familia', async () => {
    await assertFails(getDocs(query(
      collection(dbFor('customer-1'), 'walkSessions'),
      where('customerId', '==', 'customer-2'),
      orderBy('scheduledDate', 'asc'),
      limit(100),
    )))
  })

  test('ni saltarse el tope de su propia lista', async () => {
    await assertFails(getDocs(query(
      collection(dbFor('customer-1'), 'walkSessions'),
      where('customerId', '==', 'customer-1'),
      orderBy('scheduledDate', 'asc'),
      limit(500),
    )))
    await assertFails(getDocs(query(collection(dbFor('customer-1'), 'dogs'), where('ownerId', '==', 'customer-1'), limit(500))))
  })
})
