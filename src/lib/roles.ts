/**
 * Roles and authorization helpers (P0.8).
 *
 * Source of authority: Firebase custom claims (`token.role`), assigned only by
 * a privileged Admin SDK process. Firestore `users/{uid}.role` is a
 * legacy mirror for profile/state and must never be used to authorize access.
 */

export const ROLES = {
  CUSTOMER: 'customer',
  WALKER: 'walker',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const TEAM_ROLES: readonly Role[] = [ROLES.WALKER, ROLES.SUPERVISOR, ROLES.ADMIN]

export type BasicCapability =
  | 'customer:own-data'
  | 'walker:assigned-sessions'
  | 'supervisor:operations'
  | 'admin:allowlisted-administration'

export interface RoleAccessPolicy {
  entry: '/login' | '/equipo'
  home: string
  allowedPrefixes: readonly string[]
  capabilities: readonly BasicCapability[]
}

export const ROLE_ACCESS: Record<Role, RoleAccessPolicy> = {
  customer: {
    entry: '/login',
    home: '/familia',
    allowedPrefixes: ['familia', 'mi-cuenta'],
    capabilities: ['customer:own-data'],
  },
  walker: {
    entry: '/equipo',
    home: '/walker',
    allowedPrefixes: ['walker', 'paseador'],
    capabilities: ['walker:assigned-sessions'],
  },
  supervisor: {
    entry: '/equipo',
    home: '/admin',
    allowedPrefixes: ['admin'],
    capabilities: ['supervisor:operations'],
  },
  admin: {
    entry: '/equipo',
    home: '/admin',
    allowedPrefixes: ['admin'],
    capabilities: ['admin:allowlisted-administration'],
  },
}

export const ACCESS_MESSAGES = {
  missingClaim: 'La cuenta está autenticada, pero no tiene un rol de equipo asignado. Solicita a administración verificar sus custom claims.',
  unsupportedClaim: 'La cuenta tiene un rol de acceso no reconocido. Solicita a administración revisar sus custom claims.',
  customerAtTeamLogin: 'Esta cuenta corresponde a Familia PET. Utiliza el acceso de familias.',
  walkerProfileMissing: 'Tu acceso de paseador existe, pero falta el perfil operativo. Administración debe completar la activación.',
  suspended: 'Tu cuenta fue suspendida. Contacta a administración.',
  invited: 'Tu invitación todavía está pendiente de activación.',
  inactive: 'Tu perfil no está activo. Contacta a administración.',
  sessionError: 'No pudimos verificar tu sesión. Revisa tu conexión e intenta nuevamente.',
} as const

export type RoleClaimStatus = 'valid' | 'legacy' | 'missing' | 'unsupported'

export interface RoleClaimResolution {
  role: Role
  claimStatus: RoleClaimStatus
  rawRole: string | null
}

export function resolveRoleClaim(value: unknown): RoleClaimResolution {
  if (value === ROLES.CUSTOMER || value === ROLES.WALKER || value === ROLES.SUPERVISOR || value === ROLES.ADMIN) {
    return { role: value, claimStatus: 'valid', rawRole: value }
  }
  if (value === 'client') return { role: ROLES.CUSTOMER, claimStatus: 'legacy', rawRole: value }
  if (value === undefined || value === null || value === '') {
    return { role: ROLES.CUSTOMER, claimStatus: 'missing', rawRole: null }
  }
  return { role: ROLES.CUSTOMER, claimStatus: 'unsupported', rawRole: String(value) }
}

// Least-privilege compatibility for Familia PET. Elevated team access must also
// check claimStatus and never treats missing/unsupported claims as authority.
export function normalizeRole(value: unknown): Role {
  return resolveRoleClaim(value).role
}

export interface TokenLike {
  claims?: Record<string, unknown>
}

export function roleFromToken(token: TokenLike | null | undefined): Role {
  return normalizeRole(token?.claims?.role)
}

export function roleClaimFromToken(token: TokenLike | null | undefined): RoleClaimResolution {
  return resolveRoleClaim(token?.claims?.role)
}

export function hasRole(role: Role | null | undefined, ...allowed: Role[]): boolean {
  return !!role && allowed.includes(role)
}

export function isTeamRole(role: Role): role is Exclude<Role, typeof ROLES.CUSTOMER> {
  return TEAM_ROLES.includes(role)
}

// ═══════════════════════════════════════════
// DESTINATION / REDIRECT (open-redirect safe)
// ═══════════════════════════════════════════

export const ROLE_HOME: Record<Role, string> = {
  customer: ROLE_ACCESS.customer.home,
  walker: ROLE_ACCESS.walker.home,
  supervisor: ROLE_ACCESS.supervisor.home,
  admin: ROLE_ACCESS.admin.home,
}

export const ROLE_ENTRY: Record<Role, '/login' | '/equipo'> = {
  customer: ROLE_ACCESS.customer.entry,
  walker: ROLE_ACCESS.walker.entry,
  supervisor: ROLE_ACCESS.supervisor.entry,
  admin: ROLE_ACCESS.admin.entry,
}

export function entryForPrivatePath(pathname: string): '/login' | '/equipo' {
  const prefix = pathname.split(/[?#]/, 1)[0].split('/')[1] ?? ''
  return prefix === 'familia' || prefix === 'mi-cuenta' ? '/login' : '/equipo'
}

export function isSafeRedirect(raw: string | null | undefined): raw is string {
  if (!raw) return false
  if (!raw.startsWith('/')) return false
  if (raw.startsWith('//')) return false
  if (raw.includes('\\')) return false
  if (raw.includes('://')) return false
  try {
    const rawPath = raw.split(/[?#]/, 1)[0]
    const decodedRawPath = decodeURIComponent(rawPath)
    const rawSegments = decodedRawPath.split('/').filter(Boolean)
    if (decodedRawPath.includes('//') || rawSegments.some((segment) => segment === '.' || segment === '..')) return false
    const url = new URL(raw, 'https://pet.local')
    if (url.origin !== 'https://pet.local' || url.hash) return false
    const decodedPath = decodeURIComponent(url.pathname)
    if (decodedPath.includes('\\') || decodedPath.includes('//')) return false
    const segments = decodedPath.split('/').filter(Boolean)
    if (segments.length === 0) return false
    if (segments.some((segment) => segment === '.' || segment === '..' || segment.includes(':'))) return false
    return true
  } catch {
    return false
  }
}

export function resolveDestination(role: Role, redirect: string | null | undefined): string {
  if (isSafeRedirect(redirect)) {
    const prefix = new URL(redirect, 'https://pet.local').pathname.split('/')[1] ?? ''
    if (ROLE_ACCESS[role].allowedPrefixes.includes(prefix)) return redirect
  }
  return ROLE_HOME[role]
}

// ═══════════════════════════════════════════
// TOKEN RENEWAL (bounded, no infinite loops)
// ═══════════════════════════════════════════

export interface TokenHolder {
  getIdToken: (forceRefresh?: boolean) => Promise<string>
  getIdTokenResult: () => Promise<{ claims?: Record<string, unknown> }>
}

export interface RoleResolution {
  role: Role
  refreshed: boolean
  claimStatus: RoleClaimStatus
  rawRole: string | null
}

export type TeamAccessDenial = 'missing-claim' | 'unsupported-claim' | 'customer-account'

export type TeamAccessDecision =
  | { allowed: true; role: typeof ROLES.WALKER | typeof ROLES.SUPERVISOR | typeof ROLES.ADMIN }
  | { allowed: false; reason: TeamAccessDenial; message: string }

export function evaluateTeamAccess(resolution: RoleResolution): TeamAccessDecision {
  if (resolution.claimStatus === 'missing') {
    return { allowed: false, reason: 'missing-claim', message: ACCESS_MESSAGES.missingClaim }
  }
  if (resolution.claimStatus === 'unsupported') {
    return { allowed: false, reason: 'unsupported-claim', message: ACCESS_MESSAGES.unsupportedClaim }
  }
  if (!isTeamRole(resolution.role)) {
    return { allowed: false, reason: 'customer-account', message: ACCESS_MESSAGES.customerAtTeamLogin }
  }
  return { allowed: true, role: resolution.role }
}

/**
 * Resolves the role from the ID token claims. If the current token does not
 * carry a team role but the account should have one (stale claims after an
 * Admin SDK change), the token is force-refreshed exactly once and re-checked.
 * Never loops.
 */
export async function refreshTokenAndGetRole(user: TokenHolder): Promise<RoleResolution> {
  const first = await user.getIdTokenResult()
  const firstResolution = roleClaimFromToken(first)
  if (isTeamRole(firstResolution.role) && firstResolution.claimStatus === 'valid') {
    return { ...firstResolution, refreshed: false }
  }

  // Force a single refresh and re-check before denying team access.
  await user.getIdToken(true)
  const second = await user.getIdTokenResult()
  const secondResolution = roleClaimFromToken(second)
  const changed = secondResolution.role !== firstResolution.role
    || secondResolution.claimStatus !== firstResolution.claimStatus
    || secondResolution.rawRole !== firstResolution.rawRole
  return { ...secondResolution, refreshed: changed }
}
