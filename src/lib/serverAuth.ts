import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { ROLES } from '@/lib/roles'

/**
 * Server-side verification of Firebase ID tokens (P0.8 layer: endpoint
 * protection). Only callable in a Node/Next.js server context.
 *
 * Fails closed: without configured credentials, or with an invalid / non-walker
 * token, it returns null (deny) instead of guessing.
 */
let _initialized = false

function adminApp() {
  if (_initialized || getApps().length) {
    _initialized = true
    return getApps()[0] ?? initializeApp()
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (serviceAccount) {
    initializeApp({ credential: cert(JSON.parse(serviceAccount)) })
  } else {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    if (!projectId) throw new Error('FIREBASE_PROJECT_ID_NOT_CONFIGURED')
    // Token verification uses Google's public signing certificates. Supplying
    // the project ID avoids requiring a broad Firestore service credential.
    initializeApp({ projectId })
  }
  _initialized = true
  return getApps()[0]
}

export async function verifyWalkerToken(idToken: string): Promise<string | null> {
  if (!idToken) return null
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(idToken)
    if (decoded.role !== ROLES.WALKER) return null
    return decoded.uid
  } catch {
    return null
  }
}

export async function verifyAdminToken(idToken: string): Promise<string | null> {
  if (!idToken) return null
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(idToken)
    if (decoded.role !== ROLES.ADMIN) return null
    return decoded.uid
  } catch {
    return null
  }
}

/**
 * Verifies any authenticated customer (no role restriction) for
 * customer-facing endpoints, e.g. review eligibility. Still fails closed:
 * an invalid/expired token returns null, never a guessed uid.
 */
export async function verifyAuthenticatedToken(idToken: string): Promise<string | null> {
  if (!idToken) return null
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(idToken)
    return decoded.uid
  } catch {
    return null
  }
}

export function getServerFirestore() {
  return getFirestore(adminApp())
}
