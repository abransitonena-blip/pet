import { distanceMeters, type LatLng } from '@/lib/geo'

/**
 * El recorrido de un paseo, a partir de las lecturas que mandó el teléfono.
 *
 * El teléfono del paseador reporta su posición cada ~2 minutos, así que entre
 * dos lecturas nadie sabe por dónde caminó: la distancia que sale de aquí es la
 * suma de las líneas rectas entre lecturas y por eso siempre es *menos* que lo
 * que de verdad caminó. La interfaz lo dice como "recorrido aproximado" y
 * dibuja la línea punteada; nunca lo presenta como una medición.
 */

/** Lecturas demasiado cercanas son ruido del GPS, no un paso. */
export const PATH_NOISE_METERS = 5

export interface WalkPathPoint extends LatLng {
  outside?: boolean
}

/** Suma de las líneas rectas entre lecturas consecutivas. */
export function pathDistanceMeters(points: readonly LatLng[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const step = distanceMeters(points[index - 1], points[index])
    if (step >= PATH_NOISE_METERS) total += step
  }
  return total
}

export function formatWalkDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export interface WalkPathSummary {
  readings: number
  distanceMeters: number
  outsideCount: number
  /** Lo que se le muestra a una persona, ya redactado. */
  label: string
}

export function summarizeWalkPath(points: readonly WalkPathPoint[]): WalkPathSummary {
  const meters = pathDistanceMeters(points)
  const outsideCount = points.filter((point) => point.outside === true).length
  const parts = [`${points.length} lectura${points.length === 1 ? '' : 's'}`]
  if (points.length > 1) parts.push(`recorrido aproximado ${formatWalkDistance(meters)}`)
  if (outsideCount > 0) parts.push(`${outsideCount} fuera del área`)
  return { readings: points.length, distanceMeters: meters, outsideCount, label: parts.join(' · ') }
}
