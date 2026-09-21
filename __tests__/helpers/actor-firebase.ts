import type { Firestore } from 'firebase/firestore'

/**
 * Quién está "en sesión" durante una prueba de recorrido.
 *
 * La app importa `db` de '@/firebase/db' y `auth` de '@/firebase/config'. Aquí
 * se sustituyen por versiones que apuntan al emulador de reglas y a la persona
 * que la prueba diga, de modo que las funciones REALES de la app -- pedir un
 * paseo, asignarlo, avanzarlo, escribir en el chat -- corren contra las reglas
 * REALES. Una prueba que copia los datos a mano puede seguir pasando después de
 * que la app cambie; ésta no.
 */
export const actor: { db: Firestore | null; uid: string | null } = { db: null, uid: null }

/** Los getters se leen en cada uso, así que cambiar de persona no exige reimportar nada. */
export const dbModule = {
  get db() { return actor.db },
}

export const configModule = {
  get db() { return actor.db },
  get auth() {
    return { currentUser: actor.uid ? { uid: actor.uid, displayName: '', email: '' } : null }
  },
}
