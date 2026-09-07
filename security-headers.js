/* global process, module */

const DEFAULT_FIREBASE_AUTH_ORIGIN = 'https://pet-1cb0b.firebaseapp.com'

function firebaseAuthOrigin(value) {
  if (!value) return DEFAULT_FIREBASE_AUTH_ORIGIN
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    return url.protocol === 'https:' ? url.origin : DEFAULT_FIREBASE_AUTH_ORIGIN
  } catch {
    return DEFAULT_FIREBASE_AUTH_ORIGIN
  }
}

const authOrigin = firebaseAuthOrigin(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)

const directives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "manifest-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  `connect-src 'self' ${authOrigin} https://accounts.google.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.googleapis.com https://www.google-analytics.com https://analytics.google.com`,
  `frame-src https://accounts.google.com ${authOrigin}`,
  "worker-src 'self' blob:",
]

const REPORT_ONLY_CSP = directives.join('; ')
const PRODUCTION_CSP = [...directives, 'upgrade-insecure-requests'].join('; ')

const GLOBAL_SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Content-Security-Policy-Report-Only', value: REPORT_ONLY_CSP },
]

module.exports = {
  GLOBAL_SECURITY_HEADERS,
  PRODUCTION_CSP,
  REPORT_ONLY_CSP,
  firebaseAuthOrigin,
}
