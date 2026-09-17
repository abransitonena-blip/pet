'use client'

import { useEffect, useState } from 'react'
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/db'

/**
 * Cuántos mensajes sin leer esperan a quien está viendo la pantalla.
 *
 * El chat funcionaba, pero nadie se enteraba: había que abrir la pantalla de
 * mensajes para descubrir que había uno. Con esto el menú lo dice, que es lo que
 * conecta de verdad a administración con paseadores y familias.
 *
 * Cada lado cuenta lo suyo: el hilo guarda `unreadAdmin` y `unreadClient`, y se
 * ponen en cero al abrir la conversación.
 */

/** Cuántos hilos traen algo sin leer para administración. */
const MAX_UNREAD_THREADS = 50

export function useUnreadAdminChats(enabled = true): number {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setUnread(0)
      return
    }
    return onSnapshot(
      query(collection(db, 'conversations'), where('unreadAdmin', '>', 0), limit(MAX_UNREAD_THREADS)),
      (snapshot) => setUnread(snapshot.docs.reduce((total, item) => {
        const count = item.data().unreadAdmin
        return total + (typeof count === 'number' && count > 0 ? count : 0)
      }, 0)),
      // Sin permiso o sin red no se inventa un número: no hay aviso.
      () => setUnread(0),
    )
  }, [enabled])

  return unread
}

/** Lo que espera a una familia o a un paseador en su propio hilo. */
export function useUnreadOwnChat(uid: string): number {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!uid) {
      setUnread(0)
      return
    }
    return onSnapshot(
      doc(db, 'conversations', uid),
      (snapshot) => {
        const count = snapshot.exists() ? snapshot.data().unreadClient : 0
        setUnread(typeof count === 'number' && count > 0 ? count : 0)
      },
      () => setUnread(0),
    )
  }, [uid])

  return unread
}
