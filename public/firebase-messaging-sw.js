importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: self.location.origin.includes('localhost') ? undefined : undefined,
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {}
  self.registration.showNotification(title || '🐾 Paseos Quebrada', {
    body: body || '',
    icon: icon || '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
  })
})
