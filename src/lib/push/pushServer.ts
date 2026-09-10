import 'server-only'

import { Timestamp, type DocumentData, type Firestore } from '@google-cloud/firestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { sendPushNotification } from '@/lib/notifications/fcmAdmin.server'
import { mergeDeviceTokens, withoutTokens } from '@/lib/push/pushTokens'

/**
 * Dispositivos registrados y envío de avisos, del lado del servidor.
 *
 * Tokens live in `pushTokens/{uid}`, a collection no browser can read or
 * write: it has no rule, so Firestore's default deny applies and only this
 * privileged client reaches it. A token identifies a device, and a list of
 * them per person is exactly what must not be enumerable from a browser.
 *
 * Every entry point is a no-op while FCM_ENABLED is off.
 */

const COLLECTION = 'pushTokens'

export interface PushMessage {
  readonly title: string
  readonly body: string
  readonly url: string
  readonly tag?: string
}

function tokensOf(data: DocumentData | undefined): string[] {
  return Array.isArray(data?.tokens)
    ? data.tokens.filter((token: unknown): token is string => typeof token === 'string' && token.length > 0)
    : []
}

export async function saveDeviceToken(firestore: Firestore, uid: string, token: string): Promise<void> {
  const ref = firestore.collection(COLLECTION).doc(uid)
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    transaction.set(ref, { tokens: mergeDeviceTokens(tokensOf(snapshot.data()), token), updatedAt: Timestamp.now() })
  })
}

export async function removeDeviceTokens(firestore: Firestore, uid: string, removed: ReadonlySet<string>): Promise<void> {
  if (removed.size === 0) return
  const ref = firestore.collection(COLLECTION).doc(uid)
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) return
    transaction.set(ref, { tokens: withoutTokens(tokensOf(snapshot.data()), removed), updatedAt: Timestamp.now() })
  })
}

export async function notifyUser(
  firestore: Firestore,
  uid: string,
  message: PushMessage,
): Promise<{ sent: number; pruned: number }> {
  if (!FEATURE_FLAGS.FCM_ENABLED || !uid) return { sent: 0, pruned: 0 }

  const snapshot = await firestore.collection(COLLECTION).doc(uid).get()
  const tokens = tokensOf(snapshot.data())
  if (tokens.length === 0) return { sent: 0, pruned: 0 }

  const results = await Promise.all(tokens.map((deviceToken) => sendPushNotification({ deviceToken, ...message })))
  // FCM reports a token as unregistered once the app is uninstalled or the
  // permission is revoked; keeping it would mean retrying a dead device forever.
  const dead = new Set(tokens.filter((_, index) => {
    const result = results[index]
    return !result.ok && result.reason === 'unregistered'
  }))
  await removeDeviceTokens(firestore, uid, dead)

  return { sent: results.filter((result) => result.ok).length, pruned: dead.size }
}
