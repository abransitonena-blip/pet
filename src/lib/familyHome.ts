import type { WalkSessionStatus } from '@/lib/domainStates'
export { whenLabel } from '@/lib/dateLabels'

/**
 * El inicio de la familia, ordenado para actuar.
 *
 * Antes mostraba dos listas de los mismos paseos: "Solicitudes actuales", que
 * leía en orden ascendente con tope y por eso enseñaba los cinco paseos MÁS
 * ANTIGUOS de la cuenta, y "Mis reservas", los cinco más nuevos. Aquí sale una
 * sola lectura: el paseo que viene, cuántos más hay, y lo último que pasó.
 */

/** Un paseo que está ocurriendo; el que más avanzó va primero. */
const LIVE: readonly WalkSessionStatus[] = ['in_progress', 'arrived', 'on_the_way']
/** Todavía por delante: solicitado hasta confirmado. */
export const UPCOMING_STATUSES: readonly WalkSessionStatus[] = ['requested', 'pending_assignment', 'assigned', 'confirmed']
const FINISHED: readonly WalkSessionStatus[] = ['completed', 'cancelled', 'no_show']
/** Desde aquí ya hay una persona asignada a quien escribirle. */
const WITH_WALKER: readonly WalkSessionStatus[] = ['assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress']

export interface HomeWalk {
  status: WalkSessionStatus
  date: string
  time: string
  assignedWalker?: string
}

/** Cuántos días después de un paseo tiene sentido pedir su calificación. */
export const RATING_WINDOW_DAYS = 3

export interface FamilyHome<T extends HomeWalk> {
  /** El paseo en curso o, si no hay, el siguiente por fecha y hora. */
  next: T | null
  /** Si `next` está ocurriendo ahora mismo. */
  live: boolean
  /** Paseos por delante además de `next`. */
  laterCount: number
  /** Los tres últimos que terminaron, el más reciente primero. */
  recent: T[]
}

const moment = (walk: HomeWalk) => `${walk.date}T${walk.time || '00:00'}`

export function planFamilyHome<T extends HomeWalk>(walks: readonly T[]): FamilyHome<T> {
  const live = LIVE.map((status) => walks.find((walk) => walk.status === status)).find(Boolean) ?? null
  const upcoming = walks
    .filter((walk) => UPCOMING_STATUSES.includes(walk.status))
    .sort((a, b) => moment(a).localeCompare(moment(b)))
  const next = live ?? upcoming[0] ?? null
  return {
    next,
    live: live !== null,
    laterCount: upcoming.filter((walk) => walk !== next).length,
    recent: walks
      .filter((walk) => FINISHED.includes(walk.status))
      .sort((a, b) => moment(b).localeCompare(moment(a)))
      .slice(0, 3),
  }
}

/**
 * El paseo que toca calificar: el último terminado, con paseador, y reciente.
 *
 * Pedir estrellas de un paseo de hace tres semanas no mejora nada y molesta;
 * pedirlas al terminar es cuando alguien todavía recuerda cómo estuvo. Quien
 * llame a esto decide si mostrarlo: si ya se calificó, la tarjeta se esconde
 * sola.
 */
export function walkToRate<T extends HomeWalk>(walks: readonly T[], today: string): T | null {
  const since = (() => {
    const [year, month, day] = today.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day - RATING_WINDOW_DAYS)).toISOString().slice(0, 10)
  })()
  return walks
    .filter((walk) => walk.status === 'completed' && Boolean(walk.assignedWalker) && walk.date >= since && walk.date <= today)
    .sort((a, b) => `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`))[0] ?? null
}

export function hasWalker(walk: HomeWalk): boolean {
  return WITH_WALKER.includes(walk.status) && Boolean(walk.assignedWalker)
}
