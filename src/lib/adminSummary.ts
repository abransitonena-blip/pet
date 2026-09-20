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

/**
 * Lo que está pasando ahora mismo, para quien opera.
 *
 * El Resumen decía "3 paseos en marcha para hoy" y ahí se acababa: para saber
 * cuáles, quién los lleva y en qué van, había que abrir Solicitudes y paseos y
 * buscarlos entre los demás. Estos son los que ya salieron -- en camino, en la
 * puerta o paseando --, del más avanzado al menos, porque el que ya está
 * paseando es el que puede necesitar algo.
 *
 * No cuesta ninguna lectura de más: sale de los mismos paseos que el panel ya
 * tiene en la mano.
 */
const ON_THE_STREET: readonly WalkSessionStatus[] = ['in_progress', 'arrived', 'on_the_way']

export function walksOnTheStreet<T extends { date: string; status: WalkSessionStatus; time?: string }>(
  walks: readonly T[],
  today: string,
): T[] {
  return walks
    .filter((walk) => walk.date === today && ON_THE_STREET.includes(walk.status))
    .sort((a, b) => {
      const byStatus = ON_THE_STREET.indexOf(a.status) - ON_THE_STREET.indexOf(b.status)
      return byStatus !== 0 ? byStatus : (a.time ?? '').localeCompare(b.time ?? '')
    })
}
