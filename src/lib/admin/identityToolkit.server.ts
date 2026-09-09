import 'server-only'

import { getPrivilegedAuthClient, getPrivilegedIdentityConfig } from '@/lib/finance/serverIdentity'
import { ROLES, type Role } from '@/lib/roles'

/**
 * Role custom claims without Cloud Functions.
 *
 * `functions/index.js` still contains a `setUserRole` callable, but that code
 * has never been deployed and cannot be: the project has no billing account,
 * which the owner cannot open. Custom claims are the single source of
 * authority for every Firestore rule in this app, so with Functions blocked
 * there was no way at all to turn an account into a walker.
 *
 * The Identity Toolkit REST API does the same job over plain HTTPS, and it is
 * part of Firebase Auth (free tier), not Functions. We call it with the T3
 * Workload Identity Federation client that already backs the privileged
 * Firestore and FCM paths -- no service-account key is stored anywhere. The
 * service account needs roles/firebaseauth.admin.
 *
 * Fails closed: every function returns a typed failure instead of throwing or
 * guessing, and none of them can be reached without an admin ID token.
 */

const IDENTITY_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1'

export interface IdentityUser {
  readonly uid: string
  readonly email: string
  readonly displayName: string
  readonly role: Role | null
  readonly disabled: boolean
}

export type IdentityFailure =
  | 'not-configured'
  | 'user-not-found'
  | 'permission-denied'
  | 'request-failed'

export type IdentityResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: IdentityFailure; readonly detail?: string }

interface RawIdentityUser {
  localId?: string
  email?: string
  displayName?: string
  customAttributes?: string
  disabled?: boolean
}

function parseRole(customAttributes: string | undefined): Role | null {
  if (!customAttributes) return null
  try {
    const parsed = JSON.parse(customAttributes) as { role?: unknown }
    const role = parsed.role
    return role === ROLES.CUSTOMER || role === ROLES.WALKER || role === ROLES.SUPERVISOR || role === ROLES.ADMIN
      ? role
      : null
  } catch {
    return null
  }
}

function toIdentityUser(raw: RawIdentityUser): IdentityUser | null {
  if (!raw.localId) return null
  return {
    uid: raw.localId,
    email: raw.email ?? '',
    displayName: raw.displayName ?? '',
    role: parseRole(raw.customAttributes),
    disabled: raw.disabled === true,
  }
}

function classify(error: unknown): IdentityResult<never> {
  const detail = error instanceof Error ? error.message : String(error)
  // A federated identity that is not bound to this Vercel environment, or a
  // service account without roles/firebaseauth.admin, both surface here. They
  // are worth telling apart from a genuine bad request.
  const denied = /permission|denied|unauthorized|unauthenticated|forbidden|oidc|token|credential/i.test(detail)
  return { ok: false, reason: denied ? 'permission-denied' : 'request-failed', detail }
}

async function callIdentityToolkit<T>(path: string, body: unknown): Promise<IdentityResult<T>> {
  const config = getPrivilegedIdentityConfig()
  const authClient = getPrivilegedAuthClient()
  if (!config || !authClient) return { ok: false, reason: 'not-configured' }

  try {
    const response = await authClient.request<T>({
      url: `${IDENTITY_TOOLKIT}/projects/${config.projectId}/${path}`,
      method: 'POST',
      data: body,
    })
    return { ok: true, value: response.data }
  } catch (error) {
    return classify(error)
  }
}

/** Looks up an existing Firebase Auth account. Never creates one. */
export async function findUserByEmail(email: string): Promise<IdentityResult<IdentityUser>> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return { ok: false, reason: 'user-not-found' }

  const result = await callIdentityToolkit<{ users?: RawIdentityUser[] }>('accounts:lookup', { email: [normalized] })
  if (!result.ok) return result

  const raw = result.value.users?.[0]
  const user = raw ? toIdentityUser(raw) : null
  return user ? { ok: true, value: user } : { ok: false, reason: 'user-not-found' }
}

/** Looks up an existing Firebase Auth account by UID. */
export async function findUserByUid(uid: string): Promise<IdentityResult<IdentityUser>> {
  if (!uid.trim()) return { ok: false, reason: 'user-not-found' }

  const result = await callIdentityToolkit<{ users?: RawIdentityUser[] }>('accounts:lookup', { localId: [uid.trim()] })
  if (!result.ok) return result

  const raw = result.value.users?.[0]
  const user = raw ? toIdentityUser(raw) : null
  return user ? { ok: true, value: user } : { ok: false, reason: 'user-not-found' }
}

/**
 * Sets `role` on the account's custom claims, replacing whatever was there.
 * The claim only reaches Firestore rules after the account's ID token is
 * refreshed, which `refreshTokenAndGetRole` already forces once on login.
 */
export async function setUserRoleClaim(uid: string, role: Role): Promise<IdentityResult<IdentityUser>> {
  const result = await callIdentityToolkit<RawIdentityUser>('accounts:update', {
    localId: uid,
    customAttributes: JSON.stringify({ role }),
  })
  if (!result.ok) return result

  // accounts:update echoes back a thin payload, so re-read to report the
  // claim that is actually stored rather than the one we hoped to store.
  return findUserByUid(uid)
}

export function identityFailureMessage(reason: IdentityFailure): string {
  if (reason === 'not-configured') {
    return 'La identidad privilegiada del servidor no está configurada en este entorno, por lo que no se pueden asignar roles.'
  }
  if (reason === 'user-not-found') {
    return 'No existe una cuenta de Firebase Auth con ese correo. La persona debe registrarse primero.'
  }
  if (reason === 'permission-denied') {
    return 'El servidor no tiene permiso para modificar cuentas en este entorno. Revisa el binding de Workload Identity y el rol firebaseauth.admin.'
  }
  return 'No pudimos completar la operación de identidad. Inténtalo de nuevo.'
}
