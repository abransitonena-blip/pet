/**
 * Pure navigation-gate logic (P0.8), kept free of `next/server` so it can be
 * unit-tested without the Next.js runtime.
 *
 * This is a GENERAL gate only: it separates public routes from protected areas
 * and sends unauthenticated users to /login. Real authorization lives in the
 * protected layouts (custom claims via useSessionRole), Firestore Rules, and
 * Cloud Functions. A client cookie must never decide access — only the
 * presence of a session flag.
 */

import { entryForPrivatePath } from '@/lib/roles'

export const PRIVATE_ROUTES = [
  '/admin',
  '/familia',
  '/walker',
  '/supervisor',
  // legacy aliases (next.config redirects /mi-cuenta → /familia, /paseador → /walker)
  '/mi-cuenta',
  '/paseador',
]

export function matchPrivateRoute(pathname: string): string | null {
  for (const prefix of PRIVATE_ROUTES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return prefix
  }
  return null
}

/**
 * @returns null → public, let it pass
 *          '/login' → unauthenticated customer on a Familia PET route
 *          '/equipo' → unauthenticated staff member on an internal route
 *          otherwise → private route prefix, let the layout gate authorize
 */
export function middlewareDecision(pathname: string, hasSession: boolean): string | null {
  const prefix = matchPrivateRoute(pathname)
  if (!prefix) return null
  if (!hasSession) return entryForPrivatePath(pathname)
  return prefix
}
