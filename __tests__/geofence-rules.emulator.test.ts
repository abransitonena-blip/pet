/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'

/**
 * Tracking points and zone alerts are written only by /api/tracking/point
 * (privileged client, rules bypassed). From a browser: staff read them and can
 * only acknowledge an alert; walkers and families can do neither.
 */

const PROJECT_ID = 'demo-pet-geofence'
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
    await setDoc(doc(db, 'walkerProfiles', 'walker-1'), { status: 'active' })
    await setDoc(doc(db, 'geofenceAlerts', 'session-1'), {
      sessionId: 'session-1', walkerId: 'walker-1', walkerName: 'Paseador', customerId: 'customer-1',
      zoneId: 'zone-1', zoneName: 'Centro', status: 'open', lastOutsideAt: NOW, distanceMeters: 2400,
    })
    await setDoc(doc(db, 'walkTracks', 'session-1', 'points', 'point-1'), {
      lat: 19.45, lng: -99.13, accuracy: 20, outside: true, walkerId: 'walker-1', capturedAt: NOW,
    })
  })
})

afterAll(async () => env.cleanup())

describe('rastreo durante el paseo', () => {
  test('staff lee alertas y puntos; paseador y familia no', async () => {
    await assertSucceeds(getDoc(doc(dbFor('admin-1', 'admin'), 'geofenceAlerts', 'session-1')))
    await assertSucceeds(getDoc(doc(dbFor('supervisor-1', 'supervisor'), 'geofenceAlerts', 'session-1')))
    await assertSucceeds(getDoc(doc(dbFor('admin-1', 'admin'), 'walkTracks', 'session-1', 'points', 'point-1')))
    await assertFails(getDoc(doc(dbFor('walker-1', 'walker'), 'geofenceAlerts', 'session-1')))
    await assertFails(getDoc(doc(dbFor('customer-1', 'customer'), 'geofenceAlerts', 'session-1')))
    await assertFails(getDoc(doc(dbFor('walker-1', 'walker'), 'walkTracks', 'session-1', 'points', 'point-1')))
  })

  test('staff solo marca Enterado, con su propio UID y la hora del servidor', async () => {
    const admin = dbFor('admin-1', 'admin')
    await assertFails(updateDoc(doc(admin, 'geofenceAlerts', 'session-1'), { status: 'acknowledged', acknowledgedBy: 'otra-persona', acknowledgedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(admin, 'geofenceAlerts', 'session-1'), { status: 'acknowledged', acknowledgedBy: 'admin-1', acknowledgedAt: serverTimestamp(), zoneName: 'Otra' }))
    await assertFails(updateDoc(doc(admin, 'geofenceAlerts', 'session-1'), { status: 'open', acknowledgedBy: 'admin-1', acknowledgedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(doc(admin, 'geofenceAlerts', 'session-1'), { status: 'acknowledged', acknowledgedBy: 'admin-1', acknowledgedAt: serverTimestamp() }))
  })

  test('nadie crea alertas ni puntos desde el navegador', async () => {
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'geofenceAlerts', 'session-2'), { status: 'open' }))
    await assertFails(setDoc(doc(dbFor('walker-1', 'walker'), 'walkTracks', 'session-1', 'points', 'point-2'), { lat: 19.4, lng: -99.1 }))
    await assertFails(setDoc(doc(dbFor('admin-1', 'admin'), 'walkTracks', 'session-1', 'points', 'point-3'), { lat: 19.4, lng: -99.1 }))
  })
})
