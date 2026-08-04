import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = '__session'
const ROLE_COOKIE = '__role'

// SECURITY MODEL:
// - __session: boolean flag ("has logged in").
// - __role: role string ('admin' | 'walker' | 'client') set during login.
// - Middleware checks __role server-side for route access.
// - Real auth verification: Firebase Auth (onAuthStateChanged) + Firestore Rules (request.auth.uid).

const ROLE_ROUTES: Record<string, string[]> = {
  '/admin': ['admin'],
  '/familia': ['client', 'admin', 'walker'],
  '/walker': ['walker'],
  // legacy aliases (next.config redirects /mi-cuenta → /familia, /paseador → /walker)
  '/mi-cuenta': ['client', 'admin', 'walker'],
  '/paseador': ['walker'],
}

function matchRoute(pathname: string): string | null {
  for (const prefix of Object.keys(ROLE_ROUTES)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return prefix
  }
  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const routePrefix = matchRoute(pathname)
  if (!routePrefix) return NextResponse.next()

  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = request.cookies.get(ROLE_COOKIE)?.value
  const allowedRoles = ROLE_ROUTES[routePrefix]

  if (!role || !allowedRoles.includes(role)) {
    // Admins going to /walker or /familia → OK. Everyone else → redirect to home.
    if (role === 'admin') return NextResponse.next()
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/familia/:path*', '/walker/:path*', '/mi-cuenta/:path*', '/paseador/:path*'],
}
