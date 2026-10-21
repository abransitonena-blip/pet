/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, type Firestore } from 'firebase/firestore'

/**
 * Fase 37: el administrador de zona ve y delega sólo lo de su zona --
 * resuelta por la dirección, porque walkSessions todavía no lleva la suya --
 * y nunca el expediente de una familia o un perro. Los suministros sí llevan
 * su zona desde el primer día, así que su `list` funciona de verdad.
 */

const PROJECT_ID = 'demo-pet-zone-admin'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
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
    await setDoc(doc(db, 'zoneAdminProfiles', 'zadmin-1'), { zones: ['zona-1'], status: 'active' })
    await setDoc(doc(db, 'zoneAdminProfiles', 'zadmin-suspendido'), { zones: ['zona-1'], status: 'suspended' })
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active', zones: ['zona-1'] })
    await setDoc(doc(db, 'addresses', 'addr-zona-1'), { ownerId: 'family-1', zoneId: 'zona-1' })
    await setDoc(doc(db, 'addresses', 'addr-zona-2'), { ownerId: 'family-1', zoneId: 'zona-2' })
    await setDoc(doc(db, 'walkSessions', 'session-en-mi-zona'), {
      orderId: 'o1', customerId: 'family-1', dogIds: ['dog-1'], addressId: 'addr-zona-1', serviceId: 's1', serviceVersion: 1,
      status: 'requested', scheduledDate: '2026-11-01',
    })
    await setDoc(doc(db, 'walkSessions', 'session-otra-zona'), {
      orderId: 'o2', customerId: 'family-1', dogIds: ['dog-1'], addressId: 'addr-zona-2', serviceId: 's1', serviceVersion: 1,
      status: 'requested', scheduledDate: '2026-11-01',
    })
    await setDoc(doc(db, 'zoneSupplies', 'supply-zona-1'), { zoneId: 'zona-1', itemName: 'Bolsas', unit: 'paquetes', stock: 10, lowStockThreshold: 2 })
    await setDoc(doc(db, 'zoneSupplies', 'supply-zona-2'), { zoneId: 'zona-2', itemName: 'Correas', unit: 'unidades', stock: 5, lowStockThreshold: 1 })
    await setDoc(doc(db, 'zoneSupplyDeliveries', 'delivery-zona-1'), { zoneId: 'zona-1', supplyId: 'supply-zona-1', quantity: 2, walkerId: 'walker-1', deliveredAt: NOW })
  })
})

afterAll(async () => env.cleanup())

describe('zoneAdminProfiles', () => {
  test('admin lee y escribe cualquiera; el propio administrador de zona sólo lee el suyo', async () => {
    await assertSucceeds(getDoc(doc(dbFor('admin-1', 'admin'), 'zoneAdminProfiles', 'zadmin-1')))
    await assertSucceeds(getDoc(doc(dbFor('zadmin-1', 'zone_admin'), 'zoneAdminProfiles', 'zadmin-1')))
    await assertFails(getDoc(doc(dbFor('zadmin-1', 'zone_admin'), 'zoneAdminProfiles', 'zadmin-suspendido')))
    await assertFails(getDoc(doc(dbFor('family-1', 'customer'), 'zoneAdminProfiles', 'zadmin-1')))
    await assertFails(getDoc(doc(dbFor('walker-1', 'walker'), 'zoneAdminProfiles', 'zadmin-1')))
  })

  test('nadie lo escribe desde el navegador salvo admin', async () => {
    await assertFails(setDoc(doc(dbFor('zadmin-1', 'zone_admin'), 'zoneAdminProfiles', 'zadmin-1'), { zones: ['zona-9'], status: 'active' }))
    await assertSucceeds(setDoc(doc(dbFor('admin-1', 'admin'), 'zoneAdminProfiles', 'zadmin-1'), { zones: ['zona-1', 'zona-2'], status: 'active' }))
  })
})

describe('walkSessions acotado por zona (fase 37)', () => {
  test('el administrador de zona lee un paseo de su zona, no uno de otra', async () => {
    await assertSucceeds(getDoc(doc(dbFor('zadmin-1', 'zone_admin'), 'walkSessions', 'session-en-mi-zona')))
    await assertFails(getDoc(doc(dbFor('zadmin-1', 'zone_admin'), 'walkSessions', 'session-otra-zona')))
  })

  test('un administrador de zona suspendido no lee ni lo de su propia zona', async () => {
    await assertFails(getDoc(doc(dbFor('zadmin-suspendido', 'zone_admin'), 'walkSessions', 'session-en-mi-zona')))
  })

  test('list sigue sin servirle a un administrador de zona: no hay campo de zona en el documento', async () => {
    await assertFails(getDocs(query(collection(dbFor('zadmin-1', 'zone_admin'), 'walkSessions'))))
  })

  test('asigna un paseador dentro de su zona, no fuera de ella', async () => {
    const zadmin = dbFor('zadmin-1', 'zone_admin')
    await assertSucceeds(updateDoc(doc(zadmin, 'walkSessions', 'session-en-mi-zona'), {
      status: 'assigned', walkerId: 'walker-1', assignedBy: 'zadmin-1', assignedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(zadmin, 'walkSessions', 'session-otra-zona'), {
      status: 'assigned', walkerId: 'walker-1', assignedBy: 'zadmin-1', assignedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
  })
})

describe('zoneSupplies y zoneSupplyDeliveries', () => {
  test('el administrador de zona lista y lee sólo lo de su zona', async () => {
    const zadmin = dbFor('zadmin-1', 'zone_admin')
    await assertSucceeds(getDoc(doc(zadmin, 'zoneSupplies', 'supply-zona-1')))
    await assertFails(getDoc(doc(zadmin, 'zoneSupplies', 'supply-zona-2')))
    await assertSucceeds(getDocs(query(collection(zadmin, 'zoneSupplies'), where('zoneId', 'in', ['zona-1']), limit(100))))
    await assertSucceeds(getDoc(doc(zadmin, 'zoneSupplyDeliveries', 'delivery-zona-1')))
  })

  test('sólo admin crea o sube el stock; el administrador de zona nunca escribe zoneSupplies directo', async () => {
    await assertFails(setDoc(doc(dbFor('zadmin-1', 'zone_admin'), 'zoneSupplies', 'supply-zona-1'), { zoneId: 'zona-1', itemName: 'Bolsas', unit: 'paquetes', stock: 999, lowStockThreshold: 2 }))
    await assertSucceeds(updateDoc(doc(dbFor('admin-1', 'admin'), 'zoneSupplies', 'supply-zona-1'), { stock: 20 }))
  })

  test('nadie escribe zoneSupplyDeliveries desde el navegador, ni siquiera admin', async () => {
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'zoneSupplyDeliveries', 'nueva'), { zoneId: 'zona-1', supplyId: 'supply-zona-1', quantity: 1, walkerId: 'walker-1', deliveredAt: NOW }))
    await assertFails(updateDoc(doc(dbFor('zadmin-1', 'zone_admin'), 'zoneSupplyDeliveries', 'delivery-zona-1'), { quantity: 99 }))
  })
})
