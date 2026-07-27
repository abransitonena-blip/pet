import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware runs on Edge — cannot use Firebase Admin SDK directly.
//
// SECURITY MODEL:
// - The __session cookie is just a boolean flag ("has logged in at some point").
// - It does NOT contain the UID or any identity data — prevents impersonation.
// - Real authentication: Firebase Auth (onAuthStateChanged, ID tokens).
// - Data security: Firestore Security Rules (request.auth.uid).
// - Business logic: Cloud Functions (admin SDK verification).
// - This middleware only provides UX redirect (unauthenticated → login page).

const SESSION_COOKIE = '__session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value

  // Only protect internal routes
  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/paseador') || pathname.startsWith('/mi-cuenta')

  if (isProtected && !hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/mi-cuenta/:path*', '/paseador/:path*'],
}
