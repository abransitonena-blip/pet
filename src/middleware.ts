import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware runs on Edge — cannot use Firebase Admin SDK directly.
// This is defense-in-depth. Real security is in Firestore rules + Cloud Functions.

const SESSION_COOKIE = '__session'

// Route → required role mapping
const ROLE_ROUTES: Record<string, string[]> = {
  '/admin': ['admin'],
  '/paseador': ['walker'],
  '/mi-cuenta': ['client', 'admin', 'walker'],
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value

  // Find which protection rule applies
  let requiredRoles: string[] | null = null
  for (const [prefix, roles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(prefix)) {
      requiredRoles = roles
      break
    }
  }

  // Not a protected route
  if (!requiredRoles) return NextResponse.next()

  // No session cookie → redirect to login
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Session cookie exists → allow (role validation happens via Firestore rules + client auth)
  // The middleware can't decode the cookie on Edge, so we rely on:
  // 1. Firestore rules for data-level security
  // 2. Client-side role checks for UI-level security
  // 3. Cloud Functions for business logic security
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/mi-cuenta/:path*', '/paseador/:path*'],
}
