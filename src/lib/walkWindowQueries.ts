import {
  collection, getDocs, limit, orderBy, query, startAfter, where,
  type Firestore, type Query, type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { WALK_WINDOW_CAP } from '@/lib/recentWindow'

/**
 * Los paseos de una persona en un rango de fechas, y las páginas que siguen.
 *
 * Las reglas topan cada lista de paseos en 100, y Firestore no recorta: rechaza
 * la consulta entera. Un mes con más de 100 paseos no cabe en una consulta, pero
 * sí en varias: cada una pide 100 y sigue donde terminó la anterior con un
 * cursor (`startAfter`), que a las reglas no les afecta -- lo que vigilan es el
 * `limit`.
 *
 * No se pide en orden descendente ("lo más reciente primero") a propósito: los
 * índices de esta colección son ascendentes, y una consulta que necesita un
 * índice que no existe deja la pantalla vacía. Se sigue en orden ascendente y se
 * carga el resto del mes; la pantalla ordena como quiera.
 */

/** Cuántas páginas de 100 se cargan como mucho por mes: 500 paseos. */
export const WALK_WINDOW_MAX_PAGES = 5

export interface WalkWindowOwner {
  field: 'walkerId' | 'customerId'
  uid: string
}

export interface WalkWindowRange {
  since?: string
  until?: string
}

/** Una página: la primera, o la que sigue a `after`. */
export function walkWindowQuery(
  db: Firestore,
  owner: WalkWindowOwner,
  range: WalkWindowRange,
  after?: QueryDocumentSnapshot,
): Query {
  return query(
    collection(db, 'walkSessions'),
    where(owner.field, '==', owner.uid),
    ...(range.since ? [where('scheduledDate', '>=', range.since)] : []),
    ...(range.until ? [where('scheduledDate', '<=', range.until)] : []),
    orderBy('scheduledDate', 'asc'),
    ...(after ? [startAfter(after)] : []),
    limit(WALK_WINDOW_CAP),
  )
}

export interface FollowingPages {
  docs: QueryDocumentSnapshot[]
  /** Se llenaron todas las páginas permitidas: puede haber más de lo cargado. */
  beyond: boolean
}

/**
 * Las páginas que siguen a la primera, hasta `maxPages` en total (la primera
 * cuenta). `firstLast` es el último documento de la primera página.
 */
export async function loadFollowingPages(
  db: Firestore,
  owner: WalkWindowOwner,
  range: WalkWindowRange,
  firstLast: QueryDocumentSnapshot,
  maxPages: number = WALK_WINDOW_MAX_PAGES,
): Promise<FollowingPages> {
  const docs: QueryDocumentSnapshot[] = []
  let anchor = firstLast
  for (let page = 1; page < maxPages; page += 1) {
    const snapshot = await getDocs(walkWindowQuery(db, owner, range, anchor))
    docs.push(...snapshot.docs)
    // Una página que no se llena es la última: no queda nada.
    if (snapshot.docs.length < WALK_WINDOW_CAP) return { docs, beyond: false }
    anchor = snapshot.docs[snapshot.docs.length - 1]
  }
  return { docs, beyond: maxPages > 1 }
}

/** Une dos listas sin repetir: si la primera página cambia en vivo, un documento puede estar en las dos. */
export function mergeById<T extends { id: string }>(first: readonly T[], more: readonly T[]): T[] {
  if (more.length === 0) return [...first]
  const seen = new Set(first.map((item) => item.id))
  return [...first, ...more.filter((item) => !seen.has(item.id))]
}
