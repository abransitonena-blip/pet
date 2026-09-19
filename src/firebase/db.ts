import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
} from 'firebase/firestore'
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
 *
 * La caché persistente es para quien trabaja en la calle. Sin ella, lo que un
 * paseador anota sin señal vive sólo en memoria: si cierra la pestaña o el
 * teléfono la descarta, se pierde sin avisar. Con ella, lo anotado espera en el
 * disco y sale solo cuando vuelve la red, y el panel abre con lo último que
 * supo en vez de una pantalla vacía. `persistentMultipleTabManager` permite dos
 * pestañas abiertas, que es lo que pasa en un escritorio de administración.
 *
 * Si el navegador no deja guardar -- modo privado, almacenamiento lleno --,
 * Firestore avisa en consola y sigue en memoria: la app funciona igual.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // El tamaño va DENTRO de la caché: Firebase rechaza los dos juntos con
  // `invalid-argument`, y esa excepción tumba la pantalla entera al arrancar.
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
})
