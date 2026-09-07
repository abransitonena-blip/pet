/* eslint-disable react-refresh/only-export-components */
'use client'

import { useEffect, useRef, useState } from 'react'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

export const SERVICE_WORKER_UPDATE_MESSAGE = 'SKIP_WAITING'

export function requestServiceWorkerUpdate(registration: ServiceWorkerRegistration): boolean {
  if (!registration.waiting) return false
  registration.waiting.postMessage({ type: SERVICE_WORKER_UPDATE_MESSAGE })
  return true
}

export function showPushNotification(title: string, body: string, url = '/') {
  if (!FEATURE_FLAGS.FCM_ENABLED) return
  if (typeof window === 'undefined') return
  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((reg) => {
      const notifOptions: NotificationOptions & Record<string, unknown> = {
        body,
        icon: '/brand/pet-ap-dog-logo.png',
        badge: '/brand/pet-ap-dog-logo.png',
        vibrate: [200, 100, 200],
        data: { url },
      }
      reg.showNotification(title, notifOptions)
    })
  }
}

export default function PWARegister() {
  const [updateRegistration, setUpdateRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const reloading = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let cancelled = false
    let registration: ServiceWorkerRegistration | null = null

    const handleControllerChange = () => {
      if (reloading.current) return
      reloading.current = true
      window.location.reload()
    }

    const checkForUpdate = () => {
      registration?.update().catch((error: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('No se pudo comprobar la actualización de la aplicación.', error instanceof Error ? error.name : 'unknown')
        }
      })
    }

    async function registerCanonicalWorker() {
      const currentRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      if (cancelled) return

      registration = currentRegistration
      const offerUpdate = () => {
        if (navigator.serviceWorker.controller && currentRegistration.waiting) {
          setUpdateRegistration(currentRegistration)
        }
      }

      const handleUpdateFound = () => {
        const installingWorker = currentRegistration.installing
        if (!installingWorker) return

        const handleStateChange = () => {
          if (installingWorker.state === 'installed') offerUpdate()
        }
        installingWorker.addEventListener('statechange', handleStateChange, { once: true })
      }

      currentRegistration.addEventListener('updatefound', handleUpdateFound)
      offerUpdate()
      checkForUpdate()

      return () => currentRegistration.removeEventListener('updatefound', handleUpdateFound)
    }

    let removeRegistrationListener: (() => void) | undefined
    registerCanonicalWorker().then((cleanup) => {
      removeRegistrationListener = cleanup
    }).catch((error: unknown) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('No se pudo registrar la actualización de la aplicación.', error instanceof Error ? error.name : 'unknown')
      }
    })

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      removeRegistrationListener?.()
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  if (!updateRegistration) return null

  return (
    <aside
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[var(--z-overlay)] mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-slate-950 p-4 text-white shadow-xl sm:flex-row sm:items-center"
      role="status"
    >
      <p className="flex-1 text-sm leading-6">Hay una nueva versión de PET Ap disponible.</p>
      <div className="flex gap-2">
        <button
          className="min-h-11 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={() => requestServiceWorkerUpdate(updateRegistration)}
          type="button"
        >
          Actualizar
        </button>
        <button
          className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-white underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={() => setUpdateRegistration(null)}
          type="button"
        >
          Más tarde
        </button>
      </div>
    </aside>
  )
}
