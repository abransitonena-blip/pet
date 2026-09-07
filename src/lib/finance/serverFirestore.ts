import { Firestore } from '@google-cloud/firestore'
import { getPrivilegedAuthClient, getPrivilegedIdentityConfig } from './serverIdentity'

/**
 * T3 backend-privileged Firestore access via Vercel OIDC -> GCP Workload
 * Identity Federation. Fails closed (returns null) when the identity is not
 * configured, instead of guessing. See serverIdentity.ts for the shared
 * OIDC -> GCP credential exchange.
 */
let cached: Firestore | null | undefined

export function getPrivilegedFirestore(): Firestore | null {
  if (cached !== undefined) return cached

  const config = getPrivilegedIdentityConfig()
  const authClient = getPrivilegedAuthClient()
  if (!config || !authClient) {
    cached = null
    return null
  }

  cached = new Firestore({ projectId: config.projectId, authClient })
  return cached
}
