/**
 * Distancias sobre la Tierra para zonas y paseos.
 */

export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_METERS = 6_371_000

/** Great-circle (haversine) distance in meters. */
export function distanceMeters(from: LatLng, to: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** A real coordinate: finite, in range, and not the 0,0 an empty form saves. */
export function isUsableCenter(center: unknown): center is LatLng {
  if (!center || typeof center !== 'object') return false
  const { lat, lng } = center as { lat?: unknown; lng?: unknown }
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && !(lat === 0 && lng === 0)
}

/** GPS error allowance: the accuracy the phone reports, never more than this. */
export const MAX_ACCURACY_TOLERANCE_METERS = 200

/**
 * Outside only when the point is past the radius by more than the GPS error
 * the phone itself reports (capped). A walker on the boundary with a 60 m fix
 * is not "outside"; one 600 m past it is, whatever the fix says. Getting this
 * wrong in the other direction would page an admin for every noisy reading.
 */
export function isOutsideZone(
  point: LatLng,
  accuracyMeters: number,
  center: LatLng,
  radiusKm: number,
): { outside: boolean; distanceMeters: number } {
  const distance = distanceMeters(point, center)
  const tolerance = Math.min(Math.max(accuracyMeters, 0), MAX_ACCURACY_TOLERANCE_METERS)
  return { outside: distance > radiusKm * 1000 + tolerance, distanceMeters: Math.round(distance) }
}
