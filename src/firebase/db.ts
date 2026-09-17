import { initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore'
import { app } from '@/firebase/config'

/**
 * La instancia de Firestore del navegador.
 *
 * Vive aparte de `@/firebase/config` a propósito: importar este módulo mete el
 * SDK de Firestore en el paquete de esa pantalla, y las pantallas públicas no
 * lo necesitan. Quien sólo necesita sesión importa `auth` de config.
 *
 * `experimentalForceLongPolling` estaba aquí desde antes: hay redes en las que
 * el canal normal de Firestore no conecta.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
})
