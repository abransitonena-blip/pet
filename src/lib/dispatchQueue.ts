import { nextDay } from '@/lib/dateLabels'

/**
 * La cola de solicitudes por asignar, en el orden en que urgen.
 *
 * La consulta las trae por fecha de creación: la solicitud más vieja primero.
 * Pero lo que urge es la fecha del paseo -- una pedida ayer para hoy va antes
 * que una pedida hace una semana para el mes que entra. Y una cuya fecha ya
 * pasó sin paseador es la primera que alguien tiene que ver.
 */
export type DispatchUrgency = 'overdue' | 'today' | 'tomorrow' | 'later'

export const URGENCY_LABELS: Record<DispatchUrgency, string> = {
  overdue: 'Fecha pasada',
  today: 'Para hoy',
  tomorrow: 'Para mañana',
  later: 'Programada',
}

export function dispatchUrgency(scheduledDate: string, today: string): DispatchUrgency {
  if (!scheduledDate) return 'later'
  if (scheduledDate < today) return 'overdue'
  if (scheduledDate === today) return 'today'
  if (scheduledDate === nextDay(today)) return 'tomorrow'
  return 'later'
}

export function orderDispatchQueue<T extends { scheduledDate: string; scheduledStart: string }>(sessions: readonly T[]): T[] {
  // Sin fecha va al final: no se puede decir que urja.
  // Comparación por código, no localeCompare: la colación pone '~' antes que los dígitos.
  const key = (session: T) => session.scheduledDate ? `${session.scheduledDate}T${session.scheduledStart || '00:00'}` : '~'
  return [...sessions].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
}
