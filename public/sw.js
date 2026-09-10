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

// Push (FCM). Nothing can subscribe this worker until push is switched on in
// the app (FCM_ENABLED plus a VAPID key) and the person grants permission.
// Everything shown comes from the message the server composed.
self.addEventListener('push', (e) => {
  let payload = {}
  try {
    payload = e.data ? e.data.json() : {}
  } catch {
    payload = {}
  }
  const data = payload.data || {}
  const notification = payload.notification || {}
  e.waitUntil(self.registration.showNotification(data.title || notification.title || 'PET Ap', {
    body: data.body || notification.body || '',
    icon: '/brand/pet-ap-dog-logo.png',
    badge: '/brand/pet-ap-dog-mark.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin)
  // A notification only ever opens this app's own pages.
  if (target.origin !== self.location.origin) return
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === target.origin && 'focus' in client)
      if (!open) return self.clients.openWindow(target.href)
      return open.focus()
        .then((client) => (client && 'navigate' in client ? client.navigate(target.href) : undefined))
        .catch(() => self.clients.openWindow(target.href))
    })
  )
})
