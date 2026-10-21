/**
 * Qué paseos caen en la zona de un administrador de zona (fase 37).
 *
 * `walkSessions` todavía no lleva su propia zona (ver PLAN.md fase 37): se
 * resuelve igual que la sugerencia de asignación, por la zona de la dirección
 * de recogida. Por eso esto es una función pura que recibe el mapa ya
 * resuelto -- quien la llama (la ruta de servidor) hizo las lecturas de
 * Firestore -- y nunca inventa una zona para un paseo cuya dirección no la
 * tiene o ya no existe.
 */

export interface ZoneSessionInput {
  id: string
  status: string
  scheduledDate: string
  addressId: string
  walkerId: string
  dogCount: number
}

export interface ZoneSession extends ZoneSessionInput {
  zoneId: string
}

/** Sólo los paseos cuya dirección cae en alguna de las zonas administradas. */
export function sessionsInZones(
  sessions: readonly ZoneSessionInput[],
  addressZones: ReadonlyMap<string, string>,
  myZones: readonly string[],
): ZoneSession[] {
  const zoneSet = new Set(myZones)
  return sessions.flatMap((session) => {
    const zoneId = addressZones.get(session.addressId)
    if (!zoneId || !zoneSet.has(zoneId)) return []
    return [{ ...session, zoneId }]
  })
}

/** Paseos que de verdad necesitan que alguien decida algo hoy. */
const ACTIONABLE_STATUSES: ReadonlySet<string> = new Set(['requested', 'assigned', 'on_the_way', 'arrived', 'in_progress'])

export function isActionableStatus(status: string): boolean {
  return ACTIONABLE_STATUSES.has(status)
}
