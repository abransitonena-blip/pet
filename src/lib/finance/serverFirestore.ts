import { Firestore } from '@google-cloud/firestore'
import { ExternalAccountClient } from 'google-auth-library'
import { getVercelOidcToken } from '@vercel/oidc'

/**
 * T3 backend-privileged Firestore access via Vercel OIDC -> GCP Workload
 * Identity Federation. No long-lived service-account key is stored anywhere:
 * this exchanges a short-lived Vercel-signed token for short-lived GCP
 * credentials on every cold start. Fails closed (returns null) when any of
 * the required environment variables is missing instead of guessing.
 */
let cached: Firestore | null | undefined

function requiredEnv(name: string): string | null {
  const value = process.env[name]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function getPrivilegedFirestore(): Firestore | null {
  if (cached !== undefined) return cached

  const projectId = requiredEnv('GCP_PROJECT_ID')
  const projectNumber = requiredEnv('GCP_PROJECT_NUMBER')
  const serviceAccountEmail = requiredEnv('GCP_SERVICE_ACCOUNT_EMAIL')
  const poolId = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_ID')
  const providerId = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID')
  const audience = requiredEnv('GCP_AUDIENCE')

  if (!projectId || !projectNumber || !serviceAccountEmail || !poolId || !providerId || !audience) {
    cached = null
    return null
  }

  const authClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience }),
    },
  })

  if (!authClient) {
    cached = null
    return null
  }

  cached = new Firestore({ projectId, authClient })
  return cached
}
