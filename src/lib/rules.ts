/**
 * Faithful TS mirror of the authorization logic in `firestore.rules` (P0.8).
 *
 * The Firestore emulator is not runnable in this environment (no Java runtime),
 * so the rule predicates are mirrored here and exercised by jest. Keep this
 * file in sync with `firestore.rules`.
 *
 * Source of authority: custom claims (`token.role`). Firestore users/{uid}.role
 * is never used for authorization.
 */

import { normalizeRole, type Role } from '@/lib/roles'

export interface AuthContext {
  uid: string
  claims?: Record<string, unknown>
  // walkerProfiles/{uid}.status — null/undefined means no profile (customer)
  walkerProfileStatus?: string | null
}

export interface Doc {
  id?: string
  [key: string]: unknown
}

export function getClaimRole(ctx: AuthContext): Role {
  return normalizeRole(ctx.claims?.role)
}

export function hasRole(ctx: AuthContext, role: Role): boolean {
  return getClaimRole(ctx) === role
}

export function isActiveAccount(ctx: AuthContext): boolean {
  const status = ctx.walkerProfileStatus
  return status == null || status === 'active'
}

// Mirrors `request.auth != null` in firestore.rules — signed-out requests are
// denied regardless of any (client-controllable) field values.
export function isAuthenticated(ctx: AuthContext): boolean {
  return !!ctx.uid
}

export function noRoleField(data: Doc): boolean {
  return !('role' in data) && !('claims' in data) && !('customClaims' in data)
}

// ═══════════════════════════════════════════
// COLLECTION PREDICATES (mirror firestore.rules)
// ═══════════════════════════════════════════

export const RULES = {
  // users/{uid}: own read only, no client writes at all
  canReadUsers(ctx: AuthContext, uid: string): boolean {
    return isAuthenticated(ctx) && ctx.uid === uid
  },
  canWriteUsers(): boolean {
    return false
  },

  // customerProfiles/{uid}
  canReadCustomerProfile(ctx: AuthContext, uid: string): boolean {
    return isAuthenticated(ctx) && (ctx.uid === uid || hasRole(ctx, 'admin'))
  },
  canCreateCustomerProfile(ctx: AuthContext, uid: string, data: Doc): boolean {
    return isAuthenticated(ctx) && isActiveAccount(ctx) && ctx.uid === uid && noRoleField(data)
  },
  canUpdateCustomerProfile(ctx: AuthContext, uid: string, data: Doc): boolean {
    return (
      isAuthenticated(ctx) &&
      noRoleField(data) &&
      (ctx.uid === uid || hasRole(ctx, 'admin'))
    )
  },

  // dogs/{petId}
  canReadDog(ctx: AuthContext, ownerId: unknown): boolean {
    return isAuthenticated(ctx) && (ctx.uid === ownerId || hasRole(ctx, 'admin'))
  },
  canCreateDog(ctx: AuthContext, data: Doc): boolean {
    return (
      isAuthenticated(ctx) &&
      isActiveAccount(ctx) &&
      data.ownerId === ctx.uid &&
      noRoleField(data)
    )
  },
  canUpdateDog(ctx: AuthContext, ownerId: unknown, data: Doc): boolean {
    return isAuthenticated(ctx) && noRoleField(data) && (ctx.uid === ownerId || hasRole(ctx, 'admin'))
  },
  canDeleteDog(ctx: AuthContext, ownerId: unknown): boolean {
    return isAuthenticated(ctx) && (ctx.uid === ownerId || hasRole(ctx, 'admin'))
  },

  // addresses/{id}
  canReadAddress(ctx: AuthContext, ownerId: unknown): boolean {
    return isAuthenticated(ctx) && (ctx.uid === ownerId || hasRole(ctx, 'admin'))
  },
  canCreateAddress(ctx: AuthContext, data: Doc): boolean {
    return (
      isAuthenticated(ctx) &&
      isActiveAccount(ctx) &&
      data.ownerId === ctx.uid &&
      noRoleField(data)
    )
  },

  // reservations/{id}
  isReservationClient(ctx: AuthContext, res: Doc): boolean {
    return (
      isAuthenticated(ctx) &&
      typeof res.customer === 'object' &&
      (res.customer as Doc).uid === ctx.uid
    )
  },
  isAssignedWalker(ctx: AuthContext, res: Doc): boolean {
    return (
      isAuthenticated(ctx) &&
      hasRole(ctx, 'walker') &&
      typeof res.assignment === 'object' &&
      (res.assignment as Doc).walkerId === ctx.uid
    )
  },
  canReadReservation(ctx: AuthContext, res: Doc): boolean {
    return (
      isAuthenticated(ctx) &&
      isActiveAccount(ctx) &&
      (this.isReservationClient(ctx, res) ||
        this.isAssignedWalker(ctx, res) ||
        hasRole(ctx, 'admin') ||
        hasRole(ctx, 'supervisor'))
    )
  },
  canCreateReservation(ctx: AuthContext, data: Doc): boolean {
    const customer = data.customer as Doc | undefined
    return (
      isAuthenticated(ctx) &&
      isActiveAccount(ctx) &&
      noRoleField(data) &&
      (customer?.uid === ctx.uid || hasRole(ctx, 'admin'))
    )
  },
  canUpdateReservation(ctx: AuthContext, res: Doc, next: Doc): boolean {
    return (
      isAuthenticated(ctx) &&
      isActiveAccount(ctx) &&
      (hasRole(ctx, 'admin') ||
        this.isAssignedWalker(ctx, res) ||
        (this.isReservationClient(ctx, res) &&
          next.status === 'cancelled' &&
          res.status !== 'completed' &&
          res.status !== 'cancelled' &&
          res.status !== 'no_show'))
    )
  },

  // serviceOrders/sessions
  canReadSession(ctx: AuthContext, session: Doc): boolean {
    return (
      isAuthenticated(ctx) &&
      (ctx.uid === session.clientId ||
        ctx.uid === session.walkerId ||
        hasRole(ctx, 'admin') ||
        hasRole(ctx, 'supervisor'))
    )
  },

  // wallets/{uid}: owner or admin — walkers (finance) denied
  canReadWallet(ctx: AuthContext, walletUid: string): boolean {
    return isAuthenticated(ctx) && (ctx.uid === walletUid || hasRole(ctx, 'admin'))
  },

  // users write / role elevation: always denied for clients
  canWriteOwnRole(): boolean {
    return false
  },
  canAssignRole(ctx: AuthContext): boolean {
    return isAuthenticated(ctx) && hasRole(ctx, 'admin')
  },

  // walkerProfiles/{uid}
  canUpdateWalkerProfile(ctx: AuthContext, uid: string, data: Doc): boolean {
    return (
      isAuthenticated(ctx) &&
      ((hasRole(ctx, 'walker') && ctx.uid === uid && noRoleField(data)) || hasRole(ctx, 'admin'))
    )
  },

  // audit-logs
  canReadAuditLogs(ctx: AuthContext): boolean {
    return isAuthenticated(ctx) && hasRole(ctx, 'admin')
  },
}
