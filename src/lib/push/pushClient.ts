'use client'

import { FEATURE_FLAGS } from '@/lib/featureFlags'

// '@/firebase/config' is loaded lazily below: the walker panel, the dispatch
// panel and the admin chat all import this module, and while push is off it
// must not drag the Firebase SDKs into everything that merely imports it.

/**
 * Avisos push desde el navegador: activar este dispositivo y pedir al
 * servidor que anuncie un evento.
 *
 * Two switches keep this off: the FCM_ENABLED code flag and the VAPID key
 * (NEXT_PUBLIC_FIREBASE_VAPID_KEY, generated in the Firebase console under
 * Cloud Messaging → Web Push certificates). Until both exist nothing here
 * runs and the opt-in control does not render, so nothing half-configured
 * reaches anybody.
 */

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? ''
const ENABLED_KEY = 'pet-avisos-activos'

export type PushAvailability = 'off' | 'unsupported' | 'blocked' | 'enabled' | 'available'
export type EnablePushResult = { ok: true } | { ok: false; reason: 'off' | 'unsupported' | 'blocked' | 'failed' }

function readEnabledFlag(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function writeEnabledFlag(enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(ENABLED_KEY, '1')
    else window.localStorage.removeItem(ENABLED_KEY)
  } catch {
    // Blocked storage only means the control forgets its state on reload.
  }
}

export function pushAvailability(): PushAvailability {
  if (!FEATURE_FLAGS.FCM_ENABLED || !VAPID_KEY) return 'off'
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission === 'granted' && readEnabledFlag()) return 'enabled'
  return 'available'
}

async function post(path: string, payload: unknown): Promise<boolean> {
  try {
    const { auth } = await import('@/firebase/config')
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) return false
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(payload),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function enablePush(): Promise<EnablePushResult> {
  const availability = pushAvailability()
  if (availability === 'off' || availability === 'unsupported') return { ok: false, reason: availability }

  // Asked before anything is awaited: browsers only show the permission prompt
  // while the click that started this is still the active user gesture.
  const permissionRequest = Notification.requestPermission()

  try {
    const { isSupported, getToken } = await import('firebase/messaging')
    if (!(await isSupported().catch(() => false))) return { ok: false, reason: 'unsupported' }
    if ((await permissionRequest) !== 'granted') return { ok: false, reason: 'blocked' }

    const { getMessagingInstance } = await import('@/firebase/config')
    const messaging = await getMessagingInstance()
    if (!messaging) return { ok: false, reason: 'off' }
    // Reuse the app's own worker (/sw.js), which now handles push itself.
    const registration = await navigator.serviceWorker.ready
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
    if (!token || !(await post('/api/push/register', { token }))) return { ok: false, reason: 'failed' }

    writeEnabledFlag(true)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

export async function disablePush(): Promise<void> {
  writeEnabledFlag(false)
  if (!FEATURE_FLAGS.FCM_ENABLED || !VAPID_KEY) return
  try {
    const { getToken, deleteToken } = await import('firebase/messaging')
    const { getMessagingInstance } = await import('@/firebase/config')
    const messaging = await getMessagingInstance()
    if (!messaging) return
    const registration = await navigator.serviceWorker.ready
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }).catch(() => '')
    if (token) await post('/api/push/unregister', { token })
    await deleteToken(messaging).catch(() => false)
  } catch {
    // Best effort: a device that cannot be unregistered here is pruned by the
    // server the first time FCM reports its token as dead.
  }
}

/**
 * Asks the server to announce the session's current step. Fire-and-forget:
 * the walk has already advanced, and a push that fails must never undo it.
 * The sender's own device needs no push permission for this.
 */
export function notifySessionEvent(sessionId: string): void {
  if (!FEATURE_FLAGS.FCM_ENABLED) return
  void post('/api/push/session-event', { sessionId })
}

/** Tells the other side of a conversation that administration replied. */
export function notifyChatReply(conversationId: string): void {
  if (!FEATURE_FLAGS.FCM_ENABLED) return
  void post('/api/push/chat-reply', { conversationId })
}
