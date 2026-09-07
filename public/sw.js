const CACHE = 'pet-ap-static-v4'
const OWNED_CACHE_PREFIX = 'pet-ap-'
const LEGACY_CACHES = new Set(['pet-v1', 'pet-static-v1', 'pet-v2-static'])

const ASSETS = [
  '/brand/pet-ap-dog-logo.png',
]

const PRIVATE_PREFIXES = [
  '/admin', '/familia', '/walker', '/supervisor', '/equipo', '/login',
  '/cancelar', '/api/', '/mi-cuenta', '/paseador', '/__/auth/', '/auth/',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE && (key.startsWith(OWNED_CACHE_PREFIX) || LEGACY_CACHES.has(key)))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.search || e.request.mode === 'navigate') return
  if (PRIVATE_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))) return
  if (!ASSETS.includes(url.pathname)) return

  e.respondWith(
    caches.open(CACHE).then((cache) => cache.match(e.request)).then((response) => response || fetch(e.request))
  )
})

// Push/FCM handlers remain intentionally absent while FCM_ENABLED is false.
