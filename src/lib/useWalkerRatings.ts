'use client'

import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/db'

/**
 * Las calificaciones de un paseador, leídas una sola vez y en un solo lugar.
 *
 * Cada una viene de un paseo suyo que terminó, dejada por la familia de ese
 * paseo. Vivían dentro de la tarjeta de su perfil, así que el paseador sólo se
 * enteraba de su promedio si entraba a esa pantalla. Ahora la misma lectura
 * sirve para la tarjeta y para su jornada, que es donde trabaja.
 */

/** firestore.rules limita esta lista a 100 (validListLimit). */
export const MAX_WALKER_REVIEWS = 100

export interface WalkerReview {
  id: string
  rating: number
  text: string
  /** Milisegundos, o null si el servidor todavía no puso la marca de tiempo. */
  at: number | null
}

export interface WalkerRatingsResult {
  reviews: WalkerReview[]
  /** Cierto si la lectura fue rechazada: entonces no se dice nada, ni un cero. */
  denied: boolean
}

export function useWalkerRatings(uid: string): WalkerRatingsResult {
  const [reviews, setReviews] = useState<WalkerReview[]>([])
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!uid) { setReviews([]); setDenied(false); return }
    return onSnapshot(
      query(collection(db, 'walkerReviews'), where('walkerId', '==', uid), limit(MAX_WALKER_REVIEWS)),
      (snapshot) => {
        setDenied(false)
        setReviews(snapshot.docs.map((item) => {
          const data = item.data()
          const at = data.createdAt as { seconds?: unknown } | undefined
          return {
            id: item.id,
            rating: Number(data.rating) || 0,
            text: String(data.text ?? ''),
            at: typeof at?.seconds === 'number' ? at.seconds * 1000 : null,
          }
        }))
      },
      () => setDenied(true),
    )
  }, [uid])

  return { reviews, denied }
}
