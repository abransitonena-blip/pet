/**
 * Lo que no debería quedarse quieto.
 *
 * Insights ya detecta estas señales, pero sólo las ve quien abre el panel. Un
 * paseo de hoy sin paseador a las ocho de la mañana no avisa a nadie: se
 * descubre cuando la familia llama.
 *
 * Esto resume las dos que no pueden esperar, en una sola frase, para mandarla
 * al teléfono de quien opera. Es una función pura: decidir qué urge se puede
 * probar sin mandar un aviso.
 */

/** Un paseo que sigue esperando a alguien. */
const WAITING = new Set(['requested', 'pending_assignment'])
/** Abierto: ni terminado, ni cancelado, ni ausencia. */
const OPEN = new Set(['requested', 'pending_assignment', 'assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress'])

export interface GuardSession {
  id: string
  status: string
  scheduledDate: string
  walkerId?: string
}

export interface GuardReport {
  /** Paseos de hoy que todavía no tienen a quién. */
  unassignedToday: number
  /** Paseos de días pasados que nadie cerró. */
  staleOpen: number
  /** Qué decirle a quien opera, o cadena vacía si no hay nada que decir. */
  message: string
}

export function buildGuardReport(sessions: readonly GuardSession[], today: string): GuardReport {
  const unassignedToday = sessions.filter((session) => session.scheduledDate === today
    && WAITING.has(session.status)
    && !session.walkerId).length

  const staleOpen = sessions.filter((session) => session.scheduledDate < today
    && OPEN.has(session.status)).length

  const parts: string[] = []
  if (unassignedToday > 0) {
    parts.push(`${unassignedToday} paseo${unassignedToday === 1 ? '' : 's'} de hoy sin paseador`)
  }
  if (staleOpen > 0) {
    parts.push(`${staleOpen} paseo${staleOpen === 1 ? '' : 's'} de días pasados sin cerrar`)
  }

  return {
    unassignedToday,
    staleOpen,
    message: parts.length === 0 ? '' : `${parts.join(' y ')}. Ábrelos en Solicitudes y paseos.`,
  }
}

/** La marca del aviso del día: uno por día, aunque la tarea corra dos veces. */
export function guardMarker(today: string): string {
  return `guardia_${today}`
}
