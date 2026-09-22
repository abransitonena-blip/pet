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

/**
 * Un enlace a Google Maps para el mismo recorrido que ya se dibuja en Leaflet.
 *
 * Google Maps no es el mapa de la app -- lo sigue siendo Leaflet, sin llave ni
 * cuenta de facturación -- pero abrirlo ahí sirve para llegar por calles reales,
 * comparar con tráfico o vista satelital. Con dos lecturas o más se pide como
 * ruta a pie; el origen y el destino son la primera y la última, y de en medio
 * se muestrea una tajada pareja: Google no acepta una parada por cada lectura
 * de un paseo largo.
 */
const MAX_INTERMEDIATE_WAYPOINTS = 23 // + origen + destino = 25, el tope documentado de Google

function sampleEvenly<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max || max <= 0) return [...items]
  const step = items.length / max
  return Array.from({ length: max }, (_, index) => items[Math.floor(index * step)])
}

export function googleMapsRouteUrl(path: readonly LatLng[]): string | null {
  if (path.length === 0) return null
  if (path.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${path[0].lat},${path[0].lng}`
  }

  const origin = path[0]
  const destination = path[path.length - 1]
  const waypoints = sampleEvenly(path.slice(1, -1), MAX_INTERMEDIATE_WAYPOINTS)

  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'walking',
  })
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map((point) => `${point.lat},${point.lng}`).join('|'))
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
