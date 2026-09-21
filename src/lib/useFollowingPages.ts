'use client'

import { useEffect, useState } from 'react'
import type { Firestore, QueryDocumentSnapshot } from 'firebase/firestore'
import { loadFollowingPages, type WalkWindowOwner, type WalkWindowRange } from '@/lib/walkWindowQueries'

/**
 * El resto de un mes que no cupo en la primera consulta.
 *
 * La primera página sigue en vivo (un `onSnapshot`); las siguientes se piden
 * aparte, una vez, y se piden de nuevo cada vez que la primera cambia de último
 * documento: si un paseo nuevo se cuela antes del último, el que quedaba de
 * cierre pasa a la página siguiente, y con el cursor viejo se perdería.
 *
 * `firstLast` es null mientras la primera página no está llena: entonces no hay
 * nada más que pedir.
 */
export interface FollowingPagesState<T> {
  extra: T[]
  loadingMore: boolean
  /** Se llenaron todas las páginas permitidas: puede haber más de lo cargado. */
  beyond: boolean
  /** No se pudo leer el resto: lo que se ve está incompleto. */
  failed: boolean
}

export function useFollowingPages<T>(
  db: Firestore,
  owner: WalkWindowOwner,
  range: WalkWindowRange,
  firstLast: QueryDocumentSnapshot | null,
  maxPages: number,
  mapDoc: (item: QueryDocumentSnapshot) => T,
): FollowingPagesState<T> {
  const [state, setState] = useState<FollowingPagesState<T>>({ extra: [], loadingMore: false, beyond: false, failed: false })
  const anchorId = firstLast?.id ?? ''
  const { field, uid } = owner
  const { since, until } = range

  useEffect(() => {
    if (!firstLast || maxPages <= 1 || !uid) {
      setState((current) => (current.extra.length || current.loadingMore || current.beyond || current.failed
        ? { extra: [], loadingMore: false, beyond: false, failed: false }
        : current))
      return
    }
    let cancelled = false
    setState((current) => ({ ...current, loadingMore: true, failed: false }))
    loadFollowingPages(db, { field, uid }, { since, until }, firstLast, maxPages)
      .then((result) => {
        if (!cancelled) setState({ extra: result.docs.map(mapDoc), loadingMore: false, beyond: result.beyond, failed: false })
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({ ...current, loadingMore: false, failed: true }))
      })
    return () => { cancelled = true }
  }, [db, field, uid, since, until, maxPages, anchorId])

  return state
}
