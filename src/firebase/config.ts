import { initializeApp, getApps } from 'firebase/app'
import { initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

function requiredEnv(value: string | undefined, name: string): string {
  const normalized = value?.trim()
  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return normalized
}

const firebaseConfig = {
  apiKey: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, 'NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, 'NEXT_PUBLIC_FIREBASE_APP_ID'),
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0]
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
})
const auth = getAuth(app)
const storage = getStorage(app)
const functions = getFunctions(app, 'us-central1')

import type { Messaging } from 'firebase/messaging'

let _messaging: Messaging | null = null

export async function getMessagingInstance() {
  if (typeof window !== 'undefined' && !_messaging) {
    const { getMessaging } = await import('firebase/messaging')
    _messaging = getMessaging(app)
  }
  return _messaging
}

export { db, auth, storage, functions }
