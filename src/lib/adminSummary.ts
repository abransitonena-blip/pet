import type { WalkSessionStatus } from '@/lib/domainStates'

/** Todo lo que sigue en marcha: ni terminado, ni cancelado, ni ausente. */
const IN_FLIGHT: ReadonlySet<WalkSessionStatus> = new Set<WalkSessionStatus>([
  'requested', 'pending_assignment', 'assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress',
])

export interface DaySummary {
  /** Paseos de hoy que siguen en marcha. */
  today: number
  completedToday: number
  /** Paseos con fecha del primero del mes a hoy, en cualquier estado. */
  monthToDate: number
}

/**
 * Las cifras del Resumen. `today` es la fecha LOCAL (YYYY-MM-DD): con
 * `toISOString()` el panel tomaba la fecha en UTC, y en México, pasadas las
 * seis de la tarde, "hoy" ya era mañana.
 */
export function summarizeDay(walks: readonly { date: string; status: WalkSessionStatus }[], today: string): DaySummary {
  const todays = walks.filter((walk) => walk.date === today)
  return {
    today: todays.filter((walk) => IN_FLIGHT.has(walk.status)).length,
    completedToday: todays.filter((walk) => walk.status === 'completed').length,
    monthToDate: walks.filter((walk) => walk.date <= today).length,
  }
}

/** Primer día del mes de `today`, sin pasar por UTC. */
export function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`
}
