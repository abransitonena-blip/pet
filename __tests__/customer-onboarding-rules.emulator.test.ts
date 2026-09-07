/** @jest-environment node */

import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'

const PROJECT_ID = 'demo-pet-customer-onboarding'
const NOW = Timestamp.fromMillis(1_700_000_000_000)
let env: RulesTestEnvironment

function dbFor(uid: string, role?: string): Firestore {
  return env.authenticatedContext(uid, role ? { role } : undefined).firestore() as unknown as Firestore
}

beforeAll(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST?.split(':') ?? []
  if (!host || !port) throw new Error('FIRESTORE_EMULATOR_HOST is required')
  const claimHelper = readFileSync('artifacts/rules/customer-claim-default.fragment.rules', 'utf8')
  const fragment = readFileSync('artifacts/rules/customer-profiles-onboarding.fragment.rules', 'utf8')
  const rules = `
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        function isAuthenticated() { return request.auth != null; }
        ${claimHelper}
        function hasRole(role) {
          let value = getClaimRole();
          return value == role || (role == 'customer' && value == 'client');
        }
        function isCustomer() { return hasRole('customer'); }
        function isAdmin() { return hasRole('admin'); }
        function isActiveAccount() { return isAuthenticated(); }
        function noRoleField() {
          return !request.resource.data.keys().hasAny([
            'role', 'claims', 'customClaims', 'credits', 'wallet', 'loyaltyPoints',
            'financialBalance', 'adminStatus', 'permissions'
          ]);
        }
        function onlyAllowedFieldsChanged(fields) {
          return request.resource.data.diff(resource.data).affectedKeys().hasOnly(fields);
        }
        ${fragment}
        match /{document=**} { allow read, write: if false; }
      }
    }
  `
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host, port: Number(port), rules },
  })
})

beforeEach(async () => env.clearFirestore())
afterAll(async () => env.cleanup())

const profile = { name: 'Familia', email: '', phone: '', createdAt: NOW }

describe('customerProfiles onboarding candidate', () => {
  test('a missing claim creates only its own strict canonical profile', async () => {
    const customer = dbFor('customer-1')
    await assertSucceeds(setDoc(doc(customer, 'customerProfiles', 'customer-1'), profile))
    await assertFails(setDoc(doc(customer, 'customerProfiles', 'customer-2'), profile))
    await assertFails(setDoc(doc(customer, 'customerProfiles', 'extra'), { ...profile, ownerId: 'customer-1' }))
  })

  test.each(['walker', 'supervisor', 'admin'])('%s cannot use customer self-onboarding', async (role) => {
    await assertFails(setDoc(doc(dbFor(`${role}-1`, role), 'customerProfiles', `${role}-1`), profile))
  })

  test('customer updates only the own allowlist', async () => {
    const customer = dbFor('customer-1', 'customer')
    await assertSucceeds(setDoc(doc(customer, 'customerProfiles', 'customer-1'), profile))
    await assertSucceeds(updateDoc(doc(customer, 'customerProfiles', 'customer-1'), { phone: '5500000000', updatedAt: NOW }))
    await assertFails(updateDoc(doc(customer, 'customerProfiles', 'customer-1'), { credits: 10, updatedAt: NOW }))
    await assertFails(updateDoc(doc(customer, 'customerProfiles', 'customer-1'), { loyaltyPoints: 10, updatedAt: NOW }))
    await assertFails(updateDoc(doc(customer, 'customerProfiles', 'customer-1'), { adminStatus: 'active', updatedAt: NOW }))
    await assertFails(updateDoc(doc(customer, 'customerProfiles', 'customer-1'), { role: 'admin', updatedAt: NOW }))
    await assertFails(getDoc(doc(dbFor('customer-2'), 'customerProfiles', 'customer-1')))
  })

  test('admin retains explicit non-role profile administration', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, 'customerProfiles', 'customer-1'), profile)
    })
    await assertSucceeds(updateDoc(doc(dbFor('admin-1', 'admin'), 'customerProfiles', 'customer-1'), { phone: '5511111111' }))
    await assertFails(updateDoc(doc(dbFor('admin-1', 'admin'), 'customerProfiles', 'customer-1'), { role: 'admin' }))
    await assertFails(updateDoc(doc(dbFor('admin-1', 'admin'), 'customerProfiles', 'customer-1'), { credits: 100 }))
  })
})
