import { ExternalAccountClient, type BaseExternalAccountClient } from 'google-auth-library'
import { getVercelOidcToken } from '@vercel/oidc'

/**
 * Shared T3 identity: exchanges a short-lived Vercel-signed OIDC token for
 * short-lived GCP credentials via Workload Identity Federation. No
 * long-lived service-account key is stored anywhere. Used both for the
 * privileged Firestore client (serverFirestore.ts) and for calling other
 * Google APIs directly (e.g. FCM send in notifications/fcmAdmin.server.ts).
 * Fails closed (returns null) when any required env var is missing.
 */
let cached: BaseExternalAccountClient | null | undefined

function requiredEnv(name: string): string | null {
  const value = process.env[name]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export interface PrivilegedIdentityConfig {
  readonly projectId: string
  readonly serviceAccountEmail: string
  readonly audience: string
}

export function getPrivilegedIdentityConfig(): PrivilegedIdentityConfig | null {
  const projectId = requiredEnv('GCP_PROJECT_ID')
  const projectNumber = requiredEnv('GCP_PROJECT_NUMBER')
  const serviceAccountEmail = requiredEnv('GCP_SERVICE_ACCOUNT_EMAIL')
  const poolId = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_ID')
  const providerId = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID')
  const audience = requiredEnv('GCP_AUDIENCE')

  if (!projectId || !projectNumber || !serviceAccountEmail || !poolId || !providerId || !audience) {
    return null
  }
  return { projectId, serviceAccountEmail, audience }
}

export function getPrivilegedAuthClient(): BaseExternalAccountClient | null {
  if (cached !== undefined) return cached

  const config = getPrivilegedIdentityConfig()
  if (!config) {
    cached = null
    return null
  }

  const authClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: config.audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience: config.audience }),
    },
  })

  cached = authClient ?? null
  return cached
}
