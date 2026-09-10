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

// Push notifications (FCM) need two Google endpoints to register a device.
// They only open once a VAPID key is configured -- that is, once push is
// actually switched on. Until then the policy stays exactly as tight as before.
const pushConnectHosts = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  ? ' https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com'
  : ''

const directives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "manifest-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "font-src 'self'",
  // api.cloudinary.com serves the expiring links to private walk photos.
  "img-src 'self' data: blob: https://res.cloudinary.com https://api.cloudinary.com",
  `connect-src 'self' ${authOrigin} https://accounts.google.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.googleapis.com https://www.google-analytics.com https://analytics.google.com https://api.cloudinary.com${pushConnectHosts}`,
  `frame-src https://accounts.google.com ${authOrigin}`,
  "worker-src 'self' blob:",
]

const REPORT_ONLY_CSP = directives.join('; ')
const PRODUCTION_CSP = [...directives, 'upgrade-insecure-requests'].join('; ')

const GLOBAL_SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // geolocation=(self): the walker's phone records where a walk starts and
  // ends, and PET Ahora presence reads it too. `geolocation=()` denied the API
  // to this origin as well, so every reading failed silently and no walk ever
  // got a location. Third-party frames remain blocked.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
]

// Enforced in production and Preview builds (both run `next build`, NODE_ENV=production).
// Only `next dev` locally stays Report-Only, so a genuinely new external
// resource fails loud in dev instead of quietly failing in Preview.
function cspHeader(isProduction) {
  return isProduction
    ? { key: 'Content-Security-Policy', value: PRODUCTION_CSP }
    : { key: 'Content-Security-Policy-Report-Only', value: REPORT_ONLY_CSP }
}

module.exports = {
  GLOBAL_SECURITY_HEADERS,
  cspHeader,
  PRODUCTION_CSP,
  REPORT_ONLY_CSP,
  firebaseAuthOrigin,
}
