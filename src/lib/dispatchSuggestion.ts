/**
 * A quién conviene asignarle un paseo, y por qué.
 *
 * Hoy el equipo elige de una lista de nombres, a ojo, y los datos para decidir
 * ya están guardados: la zona de la dirección, las zonas que cubre cada
 * paseador, cuántos paseos tiene ese día y si ya paseó a ese perro.
 *
 * Esto **no asigna**: ordena, pone arriba al que mejor encaja y escribe el
 * motivo en palabras. Quien decide sigue siendo quien mira la pantalla, y el
 * motivo está para poder llevarle la contraria con conocimiento.
 *
 * Es una función pura: ordenar es una decisión que se puede probar sin tocar
 * Firestore.
 */

export interface SuggestableWalker {
  uid: string
  name: string
  /** Zonas que cubre, como ids. */
  zones?: readonly string[]
  /** Tope de paseos al día que declaró en su perfil. */
  maxDaily?: number | null
}

export interface AssignedWalk {
  walkerId: string
  scheduledDate: string
  dogIds?: readonly string[]
}

export interface SuggestionInput {
  /** Zona de la dirección del paseo, si se pudo resolver. */
  zoneId: string
  scheduledDate: string
  dogIds: readonly string[]
}

export interface RankedWalker {
  uid: string
  name: string
  /** Cuántos paseos ya tiene ese día. */
  walksThatDay: number
  inZone: boolean
  knowsTheDog: boolean
  /** Ya llegó a su tope declarado: se ofrece al final y se dice. */
  overCapacity: boolean
  /** Por qué está donde está, en palabras. */
  reason: string
}

function describe(walker: RankedWalker): string {
  const parts: string[] = []
  if (walker.inZone) parts.push('misma zona')
  if (walker.knowsTheDog) parts.push('ya paseó a este perro')
  parts.push(walker.walksThatDay === 0
    ? 'sin paseos ese día'
    : `${walker.walksThatDay} paseo${walker.walksThatDay === 1 ? '' : 's'} ese día`)
  if (walker.overCapacity) parts.push('llegó a su tope diario')
  return parts.join(' · ')
}

/**
 * Orden: primero quien puede (no pasó su tope), luego la zona, luego la
 * continuidad con el perro, luego quien va más libre ese día. El nombre
 * desempata, para que la lista no cambie de orden sola entre dos recargas.
 */
export function rankWalkers(
  walkers: readonly SuggestableWalker[],
  walk: SuggestionInput,
  assigned: readonly AssignedWalk[],
): RankedWalker[] {
  const sameDay = assigned.filter((item) => item.scheduledDate === walk.scheduledDate)
  const dogs = new Set(walk.dogIds)

  const ranked: RankedWalker[] = walkers.map((walker) => {
    const walksThatDay = sameDay.filter((item) => item.walkerId === walker.uid).length
    const knowsTheDog = assigned.some((item) => item.walkerId === walker.uid
      && (item.dogIds ?? []).some((dogId) => dogs.has(dogId)))
    const entry: RankedWalker = {
      uid: walker.uid,
      name: walker.name,
      walksThatDay,
      inZone: Boolean(walk.zoneId) && (walker.zones ?? []).includes(walk.zoneId),
      knowsTheDog,
      overCapacity: typeof walker.maxDaily === 'number' && walker.maxDaily > 0 && walksThatDay >= walker.maxDaily,
      reason: '',
    }
    return { ...entry, reason: describe(entry) }
  })

  return ranked.sort((a, b) => {
    if (a.overCapacity !== b.overCapacity) return a.overCapacity ? 1 : -1
    if (a.inZone !== b.inZone) return a.inZone ? -1 : 1
    if (a.knowsTheDog !== b.knowsTheDog) return a.knowsTheDog ? -1 : 1
    if (a.walksThatDay !== b.walksThatDay) return a.walksThatDay - b.walksThatDay
    return a.name.localeCompare(b.name, 'es')
  })
}

/** El sugerido es el primero, salvo que ninguno encaje por algo más que el nombre. */
export function suggestionFor(ranked: readonly RankedWalker[]): RankedWalker | null {
  const first = ranked[0]
  if (!first || first.overCapacity) return null
  return first
}
