// Transit buffer: minimum minutes between consecutive walk sessions
export const TRANSIT_BUFFER_MINUTES = 15

// Walk durations by service name (minutes) — must match SERVICES in lib/services.ts
export const WALK_DURATIONS: Record<string, number> = {
  'Paseo Individual': 30,
  'Paseo Extendido': 60,
  'Paseo Grupal': 45,
  'Paseo + Adiestramiento': 60,
  'Paseo Express': 20,
  'Paseo + Reporte': 45,
  'Paquete Semanal': 30,
}

/**
 * Parse a time string "HH:MM" to total minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Parse an arrival window "HH:MM-HH:MM" or time "HH:MM" to start minutes
 */
export function windowStartMinutes(slot: string): number {
  const start = slot.includes('-') ? slot.split('-')[0] : slot
  return timeToMinutes(start)
}

/**
 * Parse an arrival window "HH:MM-HH:MM" to end minutes
 */
export function windowEndMinutes(slot: string): number {
  if (slot.includes('-')) {
    return timeToMinutes(slot.split('-')[1])
  }
  return timeToMinutes(slot) + 20
}

/**
 * Check if a walker is available for a given time slot on a given date,
 * considering existing reservations and transit buffer.
 *
 * @param walkerId - The walker's UID
 * @param date - The reservation date (YYYY-MM-DD)
 * @param slot - The arrival window (e.g. "13:00-13:20")
 * @param walkerReservations - All reservations for this walker (can include future dates)
 * @param serviceName - Service name to determine walk duration
 * @param excludeReservationId - Optional reservation ID to exclude (for edits)
 */
export function isWalkerAvailable(
  walkerId: string,
  date: string,
  slot: string,
  walkerReservations: { date: string; arrivalWindowStart?: string; time: string; status: string; service: string; id?: string }[],
  serviceName: string,
  excludeReservationId?: string,
): { available: boolean; reason?: string } {
  const slotStart = windowStartMinutes(slot)
  const slotEnd = windowEndMinutes(slot)
  const walkDuration = WALK_DURATIONS[serviceName] || 45
  const sessionEnd = slotStart + walkDuration

  // Find overlapping/reserved slots on the same date
  const sameDay = walkerReservations.filter(
    (r) => r.date === date && r.status !== 'cancelled' && r.status !== 'completed' && r.id !== excludeReservationId,
  )

  for (const res of sameDay) {
    const resStart = windowStartMinutes(res.arrivalWindowStart || res.time)
    const resWalkDuration = WALK_DURATIONS[res.service] || 45
    const resEnd = resStart + resWalkDuration

    // Check overlap: current session + transit buffer vs existing session
    const bufferedEnd = sessionEnd + TRANSIT_BUFFER_MINUTES
    const bufferedResEnd = resEnd + TRANSIT_BUFFER_MINUTES

    // Two sessions overlap if one starts before the other ends (with buffer)
    if (slotStart < bufferedResEnd && resStart < bufferedEnd) {
      return {
        available: false,
        reason: `Conflicto con paseo de ${res.time} (${res.service})`,
      }
    }
  }

  return { available: true }
}

/**
 * Get available time slots for a walker on a specific date
 * Filters out slots that conflict with existing reservations (considering transit buffer)
 */
export function getAvailableSlotsForWalker(
  walkerId: string,
  date: string,
  allSlots: string[],
  walkerReservations: { date: string; arrivalWindowStart?: string; time: string; status: string; service: string; id?: string }[],
  serviceName: string,
  excludeReservationId?: string,
): string[] {
  return allSlots.filter((slot) =>
    isWalkerAvailable(walkerId, date, slot, walkerReservations, serviceName, excludeReservationId).available,
  )
}

/**
 * Get walker load count for a given date (excluding cancelled/completed)
 */
export function getWalkerDayLoad(
  walkerId: string,
  date: string,
  reservations: { date: string; assignment?: { walkerId: string }; status: string }[],
): number {
  return reservations.filter(
    (r) =>
      r.date === date &&
      (r.assignment?.walkerId === walkerId) &&
      r.status !== 'cancelled' &&
      r.status !== 'completed',
  ).length
}
