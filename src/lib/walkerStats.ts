/**
 * El trabajo de un paseador, contado de sus propios paseos.
 *
 * No hay puntajes ni medallas: son los paseos que hizo, contados. Un número
 * inventado -- una "puntuación" con su fórmula secreta -- se ve bonito y no le
 * dice a nadie qué hacer distinto mañana.
 *
 * Todo sale de la ventana que el panel ya tiene cargada (los 100 paseos más
 * recientes), así que la pantalla lo dice: son de esa ventana, no de toda la
 * historia. Decir "23 paseos" cuando son "23 de los últimos 100" sería mentir
 * en cuanto alguien pase de cien.
 */

export interface WalkerWorkInput {
  /** `YYYY-MM-DD` del paseo. */
  date: string
  status: string
}

export interface WalkerWorkSummary {
  completed: number
  completedThisWeek: number
  completedThisMonth: number
  upcoming: number
  cancelled: number
  /** El paseo completado más antiguo y el más reciente de la ventana. */
  firstDate: string
  lastDate: string
}

const UPCOMING_STATUSES: ReadonlySet<string> = new Set(['assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress'])
const CANCELLED_STATUSES: ReadonlySet<string> = new Set(['cancelled', 'no_show'])

/** `YYYY-MM-DD` de hace `days` días, contando desde `today`. */
export function shiftDays(today: string, days: number): string {
  const base = new Date(`${today}T12:00:00`)
  if (Number.isNaN(base.getTime())) return today
  base.setDate(base.getDate() + days)
  return base.toLocaleDateString('en-CA')
}

export function summarizeWalkerWork(sessions: readonly WalkerWorkInput[], today: string): WalkerWorkSummary {
  const weekStart = shiftDays(today, -6)
  const monthStart = `${today.slice(0, 7)}-01`

  const completedDates: string[] = []
  let completedThisWeek = 0
  let completedThisMonth = 0
  let upcoming = 0
  let cancelled = 0

  for (const session of sessions) {
    if (session.status === 'completed') {
      completedDates.push(session.date)
      if (session.date >= weekStart && session.date <= today) completedThisWeek += 1
      if (session.date >= monthStart && session.date <= today) completedThisMonth += 1
      continue
    }
    if (UPCOMING_STATUSES.has(session.status) && session.date >= today) upcoming += 1
    else if (CANCELLED_STATUSES.has(session.status)) cancelled += 1
  }

  completedDates.sort()

  return {
    completed: completedDates.length,
    completedThisWeek,
    completedThisMonth,
    upcoming,
    cancelled,
    firstDate: completedDates[0] ?? '',
    lastDate: completedDates[completedDates.length - 1] ?? '',
  }
}

/** Cuántos días distintos salió a pasear: mide constancia, no volumen. */
export function activeDays(sessions: readonly WalkerWorkInput[]): number {
  const days = new Set<string>()
  for (const session of sessions) {
    if (session.status === 'completed' && session.date) days.add(session.date)
  }
  return days.size
}
