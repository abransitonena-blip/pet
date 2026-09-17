import { initializeApp, getApps } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { requiredEnv } from '@/lib/env'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

const firebaseConfig = {
  apiKey: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, 'NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, 'NEXT_PUBLIC_FIREBASE_APP_ID'),
}

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0]
const auth = getAuth(app)
const authPersistenceReady = setPersistence(auth, browserLocalPersistence)
import type { Messaging } from 'firebase/messaging'

let _messaging: Messaging | null = null

export async function getMessagingInstance() {
  if (!FEATURE_FLAGS.FCM_ENABLED) return null
  if (typeof window !== 'undefined' && !_messaging) {
    const { getMessaging } = await import('firebase/messaging')
    _messaging = getMessaging(app)
  }
  return _messaging
}

// Sin `storage`: los archivos de PET Ap viven en Cloudinary como assets
// privados, no en Firebase Storage. Inicializarlo metía el SDK de Storage en el
// arranque de las 92 rutas para que no lo usara nadie.
//
// Sin `db` tampoco: Firestore vive en `@/firebase/db`. Este módulo lo importa
// cualquier pantalla que necesite saber quién entró, incluidas las públicas, y
// mientras `db` estuvo aquí el SDK de Firestore (unos 90 kB comprimidos) se
// cargaba en la primera pantalla del sitio para no usarse.
export { auth, authPersistenceReady }
