import { dateInTimezone, BOOKING_TIMEZONE } from '@/lib/bookingSchedule'

/**
 * A quién recordarle qué, la tarde antes del paseo.
 *
 * Un paseo olvidado es una puerta que nadie abre: el paseador llega y no hay
 * quien entregue al perro. Esto decide, a partir de los paseos de mañana,
 * qué aviso le toca a cada persona -- sin inventar ninguno: si un paseo no
 * tiene paseador todavía, al paseador no se le avisa nada, y si está cancelado
 * no se avisa a nadie.
 *
 * Es una función pura para poder probar la decisión sin mandar un solo aviso.
 */

/** Los estados que siguen en pie: un paseo cancelado no se recuerda. */
const STANDING = new Set(['requested', 'pending_assignment', 'assigned', 'confirmed'])

export interface ReminderSession {
  id: string
  customerId: string
  walkerId?: string
  status: string
  scheduledDate: string
  scheduledStart?: string
  arrivalWindowStart?: string
  arrivalWindowEnd?: string
}

export interface Reminder {
  /** A quién se le manda. */
  uid: string
  /** Para distinguir el aviso de la familia del aviso del paseador. */
  audience: 'family' | 'walker'
  sessionId: string
  title: string
  body: string
  url: string
}

/** `YYYY-MM-DD` de mañana en la hora del negocio, no en UTC. */
export function tomorrowKey(nowMs: number): string {
  return dateInTimezone(nowMs + 86_400_000, BOOKING_TIMEZONE)
}

function when(session: ReminderSession): string {
  const start = session.arrivalWindowStart || session.scheduledStart
  if (!start) return 'mañana'
  const end = session.arrivalWindowEnd
  return end ? `mañana entre ${start} y ${end}` : `mañana a las ${start}`
}

/**
 * Un aviso por familia y paseo, y uno por paseador y paseo. Un paseador con
 * tres paseos recibe tres: cada uno tiene su hora, y juntarlos escondería el
 * que empieza más temprano.
 */
export function buildReminders(sessions: readonly ReminderSession[], tomorrow: string): Reminder[] {
  const reminders: Reminder[] = []
  for (const session of sessions) {
    if (session.scheduledDate !== tomorrow) continue
    if (!STANDING.has(session.status)) continue

    if (session.customerId) {
      reminders.push({
        uid: session.customerId,
        audience: 'family',
        sessionId: session.id,
        title: 'Tu paseo es mañana',
        body: `Tienes un paseo ${when(session)}. Si ya no te acomoda, puedes moverlo o cancelarlo desde la app.`,
        url: '/familia',
      })
    }

    if (session.walkerId) {
      reminders.push({
        uid: session.walkerId,
        audience: 'walker',
        sessionId: session.id,
        title: 'Tienes un paseo mañana',
        body: `Un paseo asignado ${when(session)}. Revisa tu jornada antes de salir.`,
        url: '/walker',
      })
    }
  }
  return reminders
}

/** El identificador del aviso, para no mandarlo dos veces. */
export function reminderMarker(reminder: Reminder): string {
  return `${reminder.sessionId}_reminder_${reminder.audience}`
}
