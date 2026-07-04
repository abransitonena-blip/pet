'use client'

import { useEffect } from 'react'

export function showPushNotification(title: string, body: string, url = '/') {
  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((reg) => {
      const notifOptions: NotificationOptions & Record<string, unknown> = {
        body,
        icon: '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
        vibrate: [200, 100, 200],
        data: { url },
      }
      reg.showNotification(title, notifOptions)
    })
  }
}

export default function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  return null
}
