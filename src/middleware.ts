import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware runs on Edge — cannot use Firebase Admin SDK directly.
// This is a defense-in-depth layer. Real security is in Firestore rules.
// We check for a session cookie set by the client on login.

const PROTECTED_ROUTES = ['/admin', '/mi-cuenta', '/paseador']
const ADMIN_ROUTES = ['/admin']
const SESSION_COOKIE = '__session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value

  // Check if route is protected
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  if (!isProtected) return NextResponse.next()

  // No session cookie → redirect to login
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Session cookie exists → allow (role validation happens client-side + Firestore rules)
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/mi-cuenta/:path*', '/paseador/:path*'],
}
