/** @jest-environment node */

import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

const PROJECT_ID = 'demo-pet-p04'
const NOW = Timestamp.fromMillis(1_700_000_000_000)

let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  const claims = role ? { role } : undefined
  return env.authenticatedContext(uid, claims).firestore() as unknown as Firestore
}

function unauthenticatedDb(): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore
}

async function seed(callback: (db: Firestore) => Promise<void>): Promise<void> {
  await env.withSecurityRulesDisabled(async (context: RulesTestContext) => {
    await callback(context.firestore() as unknown as Firestore)
  })
}

const profile = { name: 'Persona', email: 'p@example.test', phone: '5500000000', createdAt: NOW }
const dog = { ownerId: 'customer-1', name: 'Luna', petType: 'perro', createdAt: NOW }
const address = { ownerId: 'customer-1', alias: 'Casa', street: 'Calle', city: 'Ciudad', zoneId: 'zone-1', createdAt: NOW }
const order = {
  customerId: 'customer-1',
  dogIds: ['dog-1'],
  serviceId: 'paseo-individual',
  serviceName: 'Paseo Individual',
  packageType: 'individual',
  numberOfSessions: 1,
  addressId: 'address-1',
  status: 'pending_confirmation',
  paymentStatus: 'pending',
  requestedSchedule: [{ date: '2026-08-10', time: '10:00-11:00' }],
  serviceVersion: 1,
  createdAt: NOW,
}
const assignedSession = {
  orderId: 'order-1',
  customerId: 'customer-1',
  dogIds: ['dog-1'],
  addressId: 'address-1',
  serviceId: 'paseo-individual',
  scheduledDate: '2026-08-10',
  scheduledStart: '10:00',
  arrivalWindowStart: '10:00',
  arrivalWindowEnd: '11:00',
  status: 'assigned',
  walkerId: 'walker-1',
  serviceVersion: 1,
  createdAt: NOW,
}

beforeAll(async () => {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST?.split(':')
  if (!hostPort?.[0] || !hostPort[1]) {
    throw new Error('FIRESTORE_EMULATOR_HOST is required; run npm run test:rules through firebase emulators:exec.')
  }
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: hostPort[0],
      port: Number(hostPort[1]),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed(async (db) => {
    await setDoc(doc(db, 'zones', 'zone-1'), { name: 'La Quebrada', active: true })
    await setDoc(doc(db, 'zones', 'zone-inactive'), { name: 'Zona inactiva', active: false })
    await setDoc(doc(db, 'dogs', 'dog-1'), dog)
    await setDoc(doc(db, 'dogs', 'dog-2'), { ...dog, ownerId: 'customer-2' })
    await setDoc(doc(db, 'addresses', 'address-1'), address)
    await setDoc(doc(db, 'addresses', 'address-2'), { ...address, ownerId: 'customer-2' })
    await setDoc(doc(db, 'appSettings', 'servicePrices'), {
      services: {
        'paseo-individual': {
          id: 'paseo-individual', name: 'Paseo Individual', amountCents: 3000,
          currency: 'MXN', active: true, complimentary: false, version: 1,
        },
      },
    })
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active', phone: '5500000001' })
    await setDoc(doc(db, 'walkerProfiles', 'walker-2'), { status: 'active', phone: '5500000002' })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('claims and profile ownership', () => {
  test('unauthenticated users cannot read a private profile', async () => {
    await seed((db) => setDoc(doc(db, 'customerProfiles', 'customer-1'), profile))
    await assertFails(getDoc(doc(unauthenticatedDb(), 'customerProfiles', 'customer-1')))
  })

  test('customer creates and edits only an allowlisted own profile', async () => {
    const customer = dbFor('customer-1', 'customer')
    await assertSucceeds(setDoc(doc(customer, 'customerProfiles', 'customer-1'), profile))
    await assertSucceeds(updateDoc(doc(customer, 'customerProfiles', 'customer-1'), { phone: '5511111111' }))
    await assertFails(updateDoc(doc(customer, 'customerProfiles', 'customer-1'), { role: 'admin' }))
    await assertFails(setDoc(doc(customer, 'customerProfiles', 'customer-2'), profile))
  })

  test('missing claim and legacy client remain customer-only', async () => {
    await assertSucceeds(setDoc(doc(dbFor('customer-1'), 'customerProfiles', 'customer-1'), profile))
    await assertSucceeds(setDoc(doc(dbFor('legacy-1', 'client'), 'customerProfiles', 'legacy-1'), profile))
    await assertFails(getDocs(query(collection(dbFor('customer-1'), 'users'), limit(10))))
  })

  test('contradictory users.role mirror never promotes a customer', async () => {
    await seed((db) => setDoc(doc(db, 'users', 'customer-1'), { role: 'admin' }))
    await assertFails(setDoc(doc(dbFor('customer-1', 'customer'), 'users', 'customer-1'), { role: 'admin' }))
    await assertFails(getDocs(query(collection(dbFor('customer-1', 'customer'), 'users'), limit(10))))
  })
})

describe('dogs, addresses and walker profiles', () => {
  test('customer owns dog CRUD but cannot transfer ownerId', async () => {
    const customer = dbFor('customer-1', 'customer')
    await assertSucceeds(setDoc(doc(customer, 'dogs', 'dog-1'), dog))
    await assertSucceeds(updateDoc(doc(customer, 'dogs', 'dog-1'), { notes: 'Prefiere sombra' }))
    await assertFails(updateDoc(doc(customer, 'dogs', 'dog-1'), { ownerId: 'customer-2' }))
    await assertFails(getDoc(doc(dbFor('customer-2', 'customer'), 'dogs', 'dog-1')))
  })

  test('owner query requires UID filter and a limit', async () => {
    await seed((db) => setDoc(doc(db, 'dogs', 'dog-1'), dog))
    const customer = dbFor('customer-1', 'customer')
    await assertSucceeds(getDocs(query(collection(customer, 'dogs'), where('ownerId', '==', 'customer-1'), limit(10))))
    await assertFails(getDocs(query(collection(customer, 'dogs'), limit(10))))
    await assertFails(getDocs(query(collection(customer, 'dogs'), where('ownerId', '==', 'customer-1'))))
  })

  test('walker cannot read customer address or dog directly', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'dogs', 'dog-1'), dog)
      await setDoc(doc(db, 'addresses', 'address-1'), address)
    })
    const walker = dbFor('walker-1', 'walker')
    await assertFails(getDoc(doc(walker, 'dogs', 'dog-1')))
    await assertFails(getDoc(doc(walker, 'addresses', 'address-1')))
  })

  test('customer can save an address in an existing active zone', async () => {
    const customer = dbFor('customer-1', 'customer')
    await assertSucceeds(setDoc(doc(customer, 'addresses', 'valid-address'), address))
  })

  test('customer cannot save an address with a missing zone', async () => {
    const customer = dbFor('customer-1', 'customer')
    await assertFails(setDoc(doc(customer, 'addresses', 'missing-zone'), { ...address, zoneId: 'unknown-zone' }))
  })

  test('customer cannot save an address in an inactive zone', async () => {
    const customer = dbFor('customer-1', 'customer')
    await assertFails(setDoc(doc(customer, 'addresses', 'inactive-zone'), { ...address, zoneId: 'zone-inactive' }))
  })

  test('customer cannot move an address to a missing zone', async () => {
    const customer = dbFor('customer-1', 'customer')
    await setDoc(doc(customer, 'addresses', 'valid-address'), address)
    await assertFails(updateDoc(doc(customer, 'addresses', 'valid-address'), { zoneId: 'unknown-zone' }))
  })

  test('walker safe profile edit succeeds, labor fields fail', async () => {
    const walker = dbFor('walker-1', 'walker')
    await assertSucceeds(updateDoc(doc(walker, 'walkerProfiles', 'walker-1'), { phone: '5512345678' }))
    await assertFails(updateDoc(doc(walker, 'walkerProfiles', 'walker-1'), { zones: ['north'] }))
    await assertFails(updateDoc(doc(walker, 'walkerProfiles', 'walker-1'), { status: 'suspended' }))
    await assertFails(updateDoc(doc(walker, 'walkerProfiles', 'walker-2'), { phone: '5512345678' }))
  })

  test('admin manages labor fields while supervisor cannot', async () => {
    await assertSucceeds(updateDoc(doc(dbFor('admin-1', 'admin'), 'walkerProfiles', 'walker-1'), { status: 'suspended' }))
    await assertFails(updateDoc(doc(dbFor('supervisor-1', 'supervisor'), 'walkerProfiles', 'walker-2'), { status: 'suspended' }))
  })

  test('suspended walker cannot operate an assigned session', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'suspended' })
      await setDoc(doc(db, 'walkSessions', 'session-1'), assignedSession)
    })
    await assertFails(getDoc(doc(dbFor('walker-1', 'walker'), 'walkSessions', 'session-1')))
  })
})

describe('service orders and canonical walk sessions', () => {
  test('missing claim remains customer-only across own dog, address, order and session', async () => {
    const customer = dbFor('customer-1')
    await assertSucceeds(setDoc(doc(customer, 'dogs', 'dog-1'), dog))
    await assertSucceeds(setDoc(doc(customer, 'addresses', 'address-1'), address))
    await assertSucceeds(setDoc(doc(customer, 'serviceOrders', 'order-1'), order))
    const requested = { ...assignedSession, status: 'requested' }
    delete (requested as Partial<typeof assignedSession>).walkerId
    await assertSucceeds(setDoc(doc(customer, 'walkSessions', 'session-1'), requested))

    const foreign = dbFor('customer-2')
    await assertFails(getDoc(doc(foreign, 'dogs', 'dog-1')))
    await assertFails(getDoc(doc(foreign, 'addresses', 'address-1')))
    await assertFails(getDoc(doc(foreign, 'serviceOrders', 'order-1')))
    await assertFails(getDoc(doc(foreign, 'walkSessions', 'session-1')))
  })

  test('customer creates only a non-financial own order', async () => {
    const customer = dbFor('customer-1', 'customer')
    await assertSucceeds(setDoc(doc(customer, 'serviceOrders', 'order-1'), order))
    await assertFails(setDoc(doc(customer, 'serviceOrders', 'priced'), { ...order, total: 500 }))
    await assertFails(setDoc(doc(customer, 'serviceOrders', 'foreign'), { ...order, customerId: 'customer-2' }))
    await assertFails(setDoc(doc(customer, 'serviceOrders', 'foreign-address'), { ...order, addressId: 'address-2' }))
    await assertFails(setDoc(doc(customer, 'serviceOrders', 'foreign-dog'), { ...order, dogIds: ['dog-2'] }))
    await assertFails(setDoc(doc(customer, 'serviceOrders', 'missing-address'), { ...order, addressId: 'missing' }))
    await assertFails(setDoc(doc(customer, 'serviceOrders', 'stale-version'), { ...order, serviceVersion: 2 }))
    await assertFails(setDoc(doc(customer, 'serviceOrders', 'unknown-service'), { ...order, serviceId: 'unknown' }))
  })

  test('legacy clientId is normalized for read only', async () => {
    await seed((db) => setDoc(doc(db, 'serviceOrders', 'legacy-order'), {
      clientId: 'legacy-1', status: 'active', paymentStatus: 'pending', createdAt: NOW,
    }))
    const legacyCustomer = dbFor('legacy-1', 'client')
    await assertSucceeds(getDoc(doc(legacyCustomer, 'serviceOrders', 'legacy-order')))
    await assertFails(updateDoc(doc(legacyCustomer, 'serviceOrders', 'legacy-order'), { status: 'completed' }))
  })

  test('customer cannot alter price, discount, payment or assignment', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'serviceOrders', 'order-1'), order)
      await setDoc(doc(db, 'walkSessions', 'session-1'), assignedSession)
    })
    const customer = dbFor('customer-1', 'customer')
    await assertFails(updateDoc(doc(customer, 'serviceOrders', 'order-1'), { total: 1 }))
    await assertFails(updateDoc(doc(customer, 'serviceOrders', 'order-1'), { discount: 999 }))
    await assertFails(updateDoc(doc(customer, 'serviceOrders', 'order-1'), { paymentStatus: 'confirmed' }))
    await assertFails(updateDoc(doc(customer, 'walkSessions', 'session-1'), { walkerId: 'customer-1' }))
  })

  test('admin uses only canonical order and payment states', async () => {
    await seed((db) => setDoc(doc(db, 'serviceOrders', 'order-1'), order))
    const orderRef = doc(dbFor('admin-1', 'admin'), 'serviceOrders', 'order-1')
    await assertSucceeds(updateDoc(orderRef, { status: 'confirmed', paymentStatus: 'under_review' }))
    await assertFails(updateDoc(orderRef, { status: 'active' }))
    await assertFails(updateDoc(orderRef, { paymentStatus: 'paid' }))
  })

  test('customer creates an unassigned requested session tied to own order', async () => {
    await seed((db) => setDoc(doc(db, 'serviceOrders', 'order-1'), order))
    const customer = dbFor('customer-1', 'customer')
    const requested = { ...assignedSession, status: 'requested' }
    delete (requested as Partial<typeof assignedSession>).walkerId
    await assertSucceeds(setDoc(doc(customer, 'walkSessions', 'session-1'), requested))
    await assertFails(setDoc(doc(customer, 'walkSessions', 'assigned-by-customer'), assignedSession))
    await assertFails(setDoc(doc(customer, 'walkSessions', 'mismatched-address'), { ...requested, addressId: 'address-2' }))
    await assertFails(setDoc(doc(customer, 'walkSessions', 'mismatched-dog'), { ...requested, dogIds: ['dog-2'] }))
    await assertFails(setDoc(doc(customer, 'walkSessions', 'mismatched-service'), { ...requested, serviceId: 'other-service' }))
    await assertFails(setDoc(doc(customer, 'walkSessions', 'mismatched-version'), { ...requested, serviceVersion: 2 }))
    await assertFails(setDoc(doc(customer, 'walkSessions', 'mismatched-date'), { ...requested, scheduledDate: '2026-08-11' }))
    await assertFails(setDoc(doc(customer, 'walkSessions', 'mismatched-time'), { ...requested, arrivalWindowEnd: '12:00' }))
  })

  test('order and requested session can be created atomically', async () => {
    const customer = dbFor('customer-1', 'customer')
    const requested = { ...assignedSession, status: 'requested' }
    delete (requested as Partial<typeof assignedSession>).walkerId
    const batch = writeBatch(customer)
    batch.set(doc(customer, 'serviceOrders', 'order-1'), order)
    batch.set(doc(customer, 'walkSessions', 'session-1'), requested)
    await assertSucceeds(batch.commit())
  })

  test('assigned active walker reads only UID-filtered sessions', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'walkSessions', 'session-1'), assignedSession)
      await setDoc(doc(db, 'walkSessions', 'session-2'), { ...assignedSession, walkerId: 'walker-2' })
    })
    const walker = dbFor('walker-1', 'walker')
    await assertSucceeds(getDoc(doc(walker, 'walkSessions', 'session-1')))
    await assertFails(getDoc(doc(walker, 'walkSessions', 'session-2')))
    await assertSucceeds(getDocs(query(
      collection(walker, 'walkSessions'),
      where('walkerId', '==', 'walker-1'),
      orderBy('scheduledDate', 'asc'),
      limit(100),
    )))
    await assertFails(getDocs(query(collection(walker, 'walkSessions'), limit(20))))
  })

  test('inactive walker cannot read an assigned session or list sessions', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'inactive' })
      await setDoc(doc(db, 'walkSessions', 'session-1'), assignedSession)
    })
    const walker = dbFor('walker-1', 'walker')
    await assertFails(getDoc(doc(walker, 'walkSessions', 'session-1')))
    await assertFails(getDocs(query(
      collection(walker, 'walkSessions'),
      where('walkerId', '==', 'walker-1'),
      orderBy('scheduledDate', 'asc'),
      limit(100),
    )))
  })

  test('walker transition requires the next state and matching timestamp', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'walkSessions', 'session-1'), assignedSession)
    })
    const sessionRef = doc(dbFor('walker-1', 'walker'), 'walkSessions', 'session-1')
    await assertSucceeds(updateDoc(sessionRef, { status: 'confirmed', confirmedAt: NOW, updatedAt: NOW }))
    await assertFails(updateDoc(sessionRef, { status: 'completed', completedAt: NOW, updatedAt: NOW }))
    await assertFails(updateDoc(sessionRef, { walkerId: 'walker-2' }))
    await assertFails(updateDoc(sessionRef, { total: 1 }))
  })

  test('walker can complete the full canonical transition sequence without skipping states', async () => {
    await seed((db) => setDoc(doc(db, 'walkSessions', 'session-sequence'), assignedSession))
    const sessionRef = doc(dbFor('walker-1', 'walker'), 'walkSessions', 'session-sequence')
    const steps = [
      ['confirmed', 'confirmedAt'],
      ['on_the_way', 'onTheWayAt'],
      ['arrived', 'arrivedAt'],
      ['in_progress', 'startedAt'],
      ['completed', 'completedAt'],
    ] as const
    for (const [status, timestampField] of steps) {
      await assertSucceeds(updateDoc(sessionRef, { status, [timestampField]: NOW, updatedAt: NOW }))
    }
  })

  test('supervisor assigns by UID; walker and customer cannot assign', async () => {
    const pending = { ...assignedSession, status: 'pending_assignment' }
    delete (pending as Partial<typeof assignedSession>).walkerId
    await seed((db) => setDoc(doc(db, 'walkSessions', 'session-1'), pending))
    await assertSucceeds(updateDoc(doc(dbFor('supervisor-1', 'supervisor'), 'walkSessions', 'session-1'), {
      status: 'assigned', walkerId: 'walker-1', assignedAt: NOW, updatedAt: NOW,
    }))
    await assertFails(updateDoc(doc(dbFor('customer-1', 'customer'), 'walkSessions', 'session-1'), { walkerId: 'customer-1' }))
  })

  test('legacy reservations are readable but never writable', async () => {
    await seed((db) => setDoc(doc(db, 'reservations', 'legacy-1'), {
      uid: 'customer-1', customer: { uid: 'customer-1' },
      assignment: { walkerId: 'walker-1' }, status: 'pending',
    }))
    await assertSucceeds(getDoc(doc(dbFor('customer-1', 'customer'), 'reservations', 'legacy-1')))
    await assertSucceeds(getDoc(doc(dbFor('walker-1', 'walker'), 'reservations', 'legacy-1')))
    await assertFails(updateDoc(doc(dbFor('admin-1', 'admin'), 'reservations', 'legacy-1'), { status: 'completed' }))
    await assertFails(setDoc(doc(dbFor('customer-1', 'customer'), 'reservations', 'new'), { uid: 'customer-1' }))
  })

  test('only assigned walker writes a report without private photo URLs', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'walkSessions', 'session-1'), assignedSession)
      await setDoc(doc(db, 'walkSessions', 'session-photos'), assignedSession)
    })
    const report = {
      sessionId: 'session-1', customerId: 'customer-1', walkerId: 'walker-1',
      notes: 'Paseo sin incidentes', createdAt: NOW,
    }
    await assertSucceeds(setDoc(doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-1'), report))
    await assertFails(setDoc(doc(dbFor('walker-2', 'walker'), 'walkReports', 'session-1'), { ...report, walkerId: 'walker-2' }))
    await assertFails(setDoc(doc(dbFor('walker-1', 'walker'), 'walkReports', 'session-photos'), { ...report, sessionId: 'session-photos', photos: ['https://public.example/photo.jpg'] }))
  })
})

describe('reviews, promotions, notifications and privileged logs', () => {
  test('staff can review an unpublished submission with a bounded query', async () => {
    await seed((db) => setDoc(doc(db, 'reviews', 'pending-review'), {
      authorUid: 'customer-1', walkSessionId: 'session-1', rating: 4,
      text: 'Pendiente', moderationStatus: 'pending', verified: false, createdAt: NOW,
    }))
    await assertSucceeds(getDocs(query(collection(dbFor('admin-1', 'admin'), 'reviews'), limit(50))))
    await assertSucceeds(getDoc(doc(dbFor('supervisor-1', 'supervisor'), 'reviews', 'pending-review')))
  })

  test('review requires own completed paid session and deterministic id', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'serviceOrders', 'order-1'), { ...order, paymentStatus: 'confirmed' })
      await setDoc(doc(db, 'walkSessions', 'session-1'), { ...assignedSession, status: 'completed' })
    })
    const customer = dbFor('customer-1', 'customer')
    const review = { authorUid: 'customer-1', walkSessionId: 'session-1', rating: 5, text: 'Excelente paseo', createdAt: NOW }
    await assertSucceeds(setDoc(doc(customer, 'reviews', 'session-1'), review))
    await assertFails(setDoc(doc(customer, 'reviews', 'different-id'), review))
    await assertFails(updateDoc(doc(customer, 'reviews', 'session-1'), { rating: 1 }))
    await assertFails(setDoc(doc(dbFor('customer-2', 'customer'), 'reviews', 'session-1'), { ...review, authorUid: 'customer-2' }))
  })

  test('review fails for unpaid session and invalid rating', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'serviceOrders', 'order-1'), order)
      await setDoc(doc(db, 'walkSessions', 'session-1'), { ...assignedSession, status: 'completed' })
    })
    const customer = dbFor('customer-1', 'customer')
    await assertFails(setDoc(doc(customer, 'reviews', 'session-1'), {
      authorUid: 'customer-1', walkSessionId: 'session-1', rating: 6, text: 'Texto', createdAt: NOW,
    }))
  })

  test('credits, loyalty, coupon and referral rewards cannot be mutated by customer', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'wallets', 'customer-1'), { promotionalBalance: 10 })
      await setDoc(doc(db, 'loyalty', 'customer-1'), { points: 10 })
      await setDoc(doc(db, 'coupons', 'coupon-1'), { code: 'PET', active: true, usedCount: 0 })
      await setDoc(doc(db, 'referrals', 'ref-1'), { referrerUid: 'customer-1', status: 'invited' })
    })
    const customer = dbFor('customer-1', 'customer')
    await assertFails(updateDoc(doc(customer, 'wallets', 'customer-1'), { promotionalBalance: 1000 }))
    await assertFails(updateDoc(doc(customer, 'loyalty', 'customer-1'), { points: 1000 }))
    await assertFails(updateDoc(doc(customer, 'coupons', 'coupon-1'), { usedCount: 1 }))
    await assertFails(updateDoc(doc(customer, 'referrals', 'ref-1'), { status: 'rewarded' }))
  })

  test('PET Ahora requests, offers and leases reject browser writes', async () => {
    await assertFails(setDoc(doc(dbFor('customer-1', 'customer'), 'petAhoraRequests', 'request-1'), { customerId: 'customer-1' }))
    await assertFails(setDoc(doc(dbFor('walker-1', 'walker'), 'petAhoraOffers', 'offer-1'), { walkerId: 'walker-1' }))
    await assertFails(setDoc(doc(dbFor('walker-1', 'walker'), 'petAhoraLeases', 'lease-1'), { walkerId: 'walker-1' }))
  })

  test('notification owner can only mark read', async () => {
    await seed((db) => setDoc(doc(db, 'notifications', 'customer-1', 'items', 'notification-1'), {
      title: 'Aviso', read: false, createdAt: NOW,
    }))
    const customer = dbFor('customer-1', 'customer')
    await assertSucceeds(getDoc(doc(customer, 'notifications', 'customer-1', 'items', 'notification-1')))
    await assertSucceeds(updateDoc(doc(customer, 'notifications', 'customer-1', 'items', 'notification-1'), { read: true }))
    await assertFails(updateDoc(doc(customer, 'notifications', 'customer-1', 'items', 'notification-1'), { title: 'Falso' }))
    await assertFails(getDoc(doc(dbFor('customer-2', 'customer'), 'notifications', 'customer-1', 'items', 'notification-1')))
  })

  test('browser cannot create an administrative audit log, even as admin', async () => {
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'audit-logs', 'fake-log'), { action: 'admin_action' }))
  })
})

describe('P0.6 gallery consent and private privacy requests', () => {
  const authorizedGalleryImage = {
    schemaVersion: 1,
    publicationStatus: 'published',
    consentRecorded: true,
    consentVerified: true,
    publicGalleryAllowed: true,
    usageRights: 'public-gallery',
    assetPublicId: 'pet-ap-public/00000000-0000-4000-8000-000000000001',
    url: 'https://res.cloudinary.com/pet-ap/image/upload/pet-ap-public/photo-1.jpg',
    width: 1200,
    height: 900,
    format: 'jpg',
    altText: 'Perrito durante un paseo autorizado',
    assetDate: NOW,
    revokedAt: null,
    pendingDeletion: false,
    createdBy: 'admin-1',
    createdAt: NOW,
    updatedAt: NOW,
  }

  const publicGalleryProjection = {
    schemaVersion: 1,
    assetPublicId: authorizedGalleryImage.assetPublicId,
    url: authorizedGalleryImage.url,
    width: authorizedGalleryImage.width,
    height: authorizedGalleryImage.height,
    format: authorizedGalleryImage.format,
    altText: authorizedGalleryImage.altText,
    updatedAt: NOW,
  }

  test('legacy gallery document without verifiable consent is not public', async () => {
    await seed((db) => setDoc(doc(db, 'gallery-images', 'legacy'), { url: 'https://example.test/legacy.jpg', title: 'Legacy' }))
    await assertFails(getDoc(doc(unauthenticatedDb(), 'gallery-images', 'legacy')))
  })

  test('private gallery remains staff-only while the minimal projection is public and limited', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'gallery-images', 'authorized'), authorizedGalleryImage)
      await setDoc(doc(db, 'gallery-public', 'authorized'), publicGalleryProjection)
    })
    await assertFails(getDoc(doc(unauthenticatedDb(), 'gallery-images', 'authorized')))
    await assertSucceeds(getDoc(doc(unauthenticatedDb(), 'gallery-public', 'authorized')))
    await assertSucceeds(getDocs(query(
      collection(unauthenticatedDb(), 'gallery-public'),
      orderBy('updatedAt', 'desc'),
      limit(50),
    )))
    await assertFails(getDocs(query(
      collection(unauthenticatedDb(), 'gallery-public'),
      orderBy('updatedAt', 'desc'),
      limit(51),
    )))
    await assertSucceeds(getDoc(doc(dbFor('admin-1', 'admin'), 'gallery-images', 'authorized')))
    await assertSucceeds(getDocs(query(
      collection(dbFor('supervisor-1', 'supervisor'), 'gallery-images'),
      where('publicationStatus', '==', 'published'),
      where('publicGalleryAllowed', '==', true),
      where('consentRecorded', '==', true),
      where('consentVerified', '==', true),
      where('usageRights', '==', 'public-gallery'),
      where('revokedAt', '==', null),
      where('pendingDeletion', '==', false),
      limit(50),
    )))
  })

  test('revocation or pending deletion prevents public gallery reads', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'gallery-images', 'revoked'), { ...authorizedGalleryImage, revokedAt: NOW })
      await setDoc(doc(db, 'gallery-images', 'pending-delete'), { ...authorizedGalleryImage, pendingDeletion: true })
    })
    await assertFails(getDoc(doc(unauthenticatedDb(), 'gallery-images', 'revoked')))
    await assertFails(getDoc(doc(unauthenticatedDb(), 'gallery-images', 'pending-delete')))
  })

  test('public and customer cannot create, publish, edit or delete gallery documents', async () => {
    const customer = dbFor('customer-1', 'customer')
    await seed((db) => setDoc(doc(db, 'gallery-images', 'owned-draft'), { ...authorizedGalleryImage, publicationStatus: 'draft' }))
    await assertFails(setDoc(doc(unauthenticatedDb(), 'gallery-images', 'public-create'), authorizedGalleryImage))
    await assertFails(updateDoc(doc(customer, 'gallery-images', 'owned-draft'), { publicationStatus: 'published' }))
    await assertFails(updateDoc(doc(customer, 'gallery-images', 'owned-draft'), { publicGalleryAllowed: false }))
    await assertFails(setDoc(doc(customer, 'gallery-public', 'owned-draft'), publicGalleryProjection))
  })

  test('admin metadata requires evidence and cannot change owner or asset URL', async () => {
    const admin = dbFor('admin-1', 'admin')
    const validDraft = {
      ...authorizedGalleryImage,
      publicationStatus: 'draft',
      publicGalleryAllowed: false,
      assetDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await assertFails(setDoc(doc(admin, 'gallery-images', 'missing-evidence'), { ...validDraft, usageRights: 'unknown' }))
    await assertSucceeds(setDoc(doc(admin, 'gallery-images', 'valid-admin'), validDraft))
    await assertFails(updateDoc(doc(admin, 'gallery-images', 'valid-admin'), { createdBy: 'admin-2', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(admin, 'gallery-images', 'valid-admin'), { url: 'https://example.test/other.jpg' }))
    await assertFails(updateDoc(doc(admin, 'gallery-images', 'valid-admin'), {
      publicationStatus: 'published',
      publicGalleryAllowed: true,
      updatedAt: serverTimestamp(),
    }))
    await assertFails(setDoc(doc(admin, 'gallery-public', 'valid-admin'), {
      ...publicGalleryProjection,
      updatedAt: serverTimestamp(),
    }))
    const publish = writeBatch(admin)
    publish.update(doc(admin, 'gallery-images', 'valid-admin'), {
      publicationStatus: 'published',
      publicGalleryAllowed: true,
      updatedAt: serverTimestamp(),
    })
    publish.set(doc(admin, 'gallery-public', 'valid-admin'), {
      ...publicGalleryProjection,
      updatedAt: serverTimestamp(),
    })
    await assertSucceeds(publish.commit())
    await assertFails(setDoc(doc(admin, 'gallery-public', 'valid-admin'), {
      ...publicGalleryProjection,
      internalOwnerUid: 'customer-1',
      updatedAt: serverTimestamp(),
    }))
    const withdraw = writeBatch(admin)
    withdraw.update(doc(admin, 'gallery-images', 'valid-admin'), {
      publicationStatus: 'withdrawn',
      publicGalleryAllowed: false,
      updatedAt: serverTimestamp(),
    })
    withdraw.delete(doc(admin, 'gallery-public', 'valid-admin'))
    await assertSucceeds(withdraw.commit())
    expect((await getDoc(doc(unauthenticatedDb(), 'gallery-public', 'valid-admin'))).exists()).toBe(false)
    await assertFails(updateDoc(doc(admin, 'gallery-images', 'valid-admin'), { pendingDeletion: true, updatedAt: serverTimestamp() }))
  })

  test('customer creates a limited private request and cannot alter its status', async () => {
    const customer = dbFor('customer-1', 'customer')
    const other = dbFor('customer-2', 'customer')
    const requestRef = doc(customer, 'privacyRequests', 'request-1')
    await assertSucceeds(setDoc(requestRef, {
      requestType: 'photo-consent-update',
      requesterUid: 'customer-1',
      channel: 'customer-portal',
      status: 'submitted',
      description: '',
      consentVersion: '2026-08-08-v1',
      requestedPhotoConsent: {
        captureAllowed: true,
        publicGalleryAllowed: false,
        socialMediaAllowed: false,
      },
      createdAt: NOW,
    }))
    await assertSucceeds(getDoc(requestRef))
    await assertFails(getDoc(doc(other, 'privacyRequests', 'request-1')))
    await assertFails(updateDoc(requestRef, { status: 'closed' }))
  })
})

describe('R1 booking schedule authorization', () => {
  const weeklyHours = {
    domingo: { enabled: false, open: '', close: '' },
    lunes: { enabled: true, open: '08:00', close: '18:00' },
    martes: { enabled: true, open: '08:00', close: '18:00' },
    miercoles: { enabled: true, open: '08:00', close: '18:00' },
    jueves: { enabled: true, open: '08:00', close: '18:00' },
    viernes: { enabled: true, open: '08:00', close: '18:00' },
    sabado: { enabled: false, open: '', close: '' },
  }

  const schedule = (version: number) => ({
    schemaVersion: 1,
    timezone: 'America/Mexico_City',
    slotIntervalMinutes: 15,
    minimumLeadMinutes: 60,
    weeklyHours,
    closedDates: [],
    active: true,
    version,
    updatedAt: serverTimestamp(),
    updatedBy: 'admin-1',
  })

  test('Admin writes a versioned schedule while public and Supervisor only read', async () => {
    const admin = dbFor('admin-1', 'admin')
    const supervisor = dbFor('supervisor-1', 'supervisor')
    const reference = doc(admin, 'appSettings', 'bookingSchedule')
    await assertSucceeds(setDoc(reference, schedule(1)))
    await assertSucceeds(getDoc(doc(unauthenticatedDb(), 'appSettings', 'bookingSchedule')))
    await assertSucceeds(getDoc(doc(supervisor, 'appSettings', 'bookingSchedule')))
    await assertFails(updateDoc(doc(supervisor, 'appSettings', 'bookingSchedule'), { active: false }))
    await assertSucceeds(setDoc(reference, schedule(2)))
  })

  test('schedule rejects an arbitrary interval, invalid hours and the wrong actor', async () => {
    const admin = dbFor('admin-1', 'admin')
    await assertFails(setDoc(doc(admin, 'appSettings', 'bookingSchedule'), { ...schedule(1), slotIntervalMinutes: 17 }))
    await assertFails(setDoc(doc(admin, 'appSettings', 'bookingSchedule'), {
      ...schedule(1),
      weeklyHours: { ...weeklyHours, lunes: { enabled: true, open: '18:00', close: '08:00' } },
    }))
    await assertFails(setDoc(doc(dbFor('customer-1', 'customer'), 'appSettings', 'bookingSchedule'), schedule(1)))
  })
})
