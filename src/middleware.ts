import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { middlewareDecision } from '@/lib/privateRoutes'

const SESSION_COOKIE = '__session'
const PRIVATE_RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}

function privateResponse(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) response.headers.set(key, value)
  return response
}

// SECURITY MODEL (P0.8):
// - This middleware is a GENERAL navigation gate only: it separates public
//   routes from protected areas and sends unauthenticated users to the
//   appropriate entry point: /login for Familia PET and /equipo for staff.
//   It must NOT be the only security barrier.
// - Real authorization lives in the protected layouts (custom claims in the ID
//   token via useSessionRole), in Firestore Rules, and in Cloud Functions.
// - The client-controllable `__role` cookie was removed: a cookie is never
//   used to decide access, only the presence of a session flag.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const decision = middlewareDecision(pathname, !!request.cookies.get(SESSION_COOKIE)?.value)
  if (decision === null) return NextResponse.next()
  if (decision === '/login' || decision === '/equipo') {
    const loginUrl = new URL(decision, request.url)
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
    return privateResponse(NextResponse.redirect(loginUrl))
  }
  return privateResponse(NextResponse.next())
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/familia/:path*',
    '/walker/:path*',
    '/supervisor/:path*',
    '/mi-cuenta/:path*',
    '/paseador/:path*',
  ],
}
