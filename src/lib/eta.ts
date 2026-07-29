const EARTH_RADIUS_KM = 6371
const AVERAGE_WALKING_SPEED_KMPH = 5
const AVERAGE_DRIVING_SPEED_KMPH = 30

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function estimateWalkingMinutes(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const km = haversineDistance(lat1, lng1, lat2, lng2)
  return Math.ceil((km / AVERAGE_WALKING_SPEED_KMPH) * 60)
}

export function estimateDrivingMinutes(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const km = haversineDistance(lat1, lng1, lat2, lng2)
  return Math.ceil((km / AVERAGE_DRIVING_SPEED_KMPH) * 60)
}

export function formatEta(minutes: number): string {
  if (minutes <= 1) return 'Llegando'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}
