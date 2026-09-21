import { daysBetweenDates } from '@/lib/customerSegments'

/**
 * El refuerzo que se acerca, avisado al teléfono de quien lo anotó.
 *
 * La familia escribe la fecha del próximo refuerzo en el perfil de su perro, y el
 * inicio ya se la recuerda cuando abre la app. Pero un recordatorio que sólo
 * existe si abres la app no es un recordatorio: se pierde justo cuando hace
 * falta. Esto lo convierte en un aviso, con la misma tarea programada de la
 * tarde.
 *
 * No inventa ninguna vigencia: sólo avisa de una fecha que la familia escribió, y
 * el texto lo dice ("el refuerzo que anotaste"). Cuándo toca cada vacuna lo
 * decide su veterinario, no esta app. Tampoco nombra la vacuna: el aviso sale en
 * la pantalla bloqueada, y quien la ve no tiene por qué saber más del perro.
 *
 * Función pura, para probar la decisión sin mandar un solo aviso.
 */

/** Cuántos días antes se avisa: una semana para agendar, y el día mismo. */
export const VACCINE_REMINDER_DAYS = [7, 0] as const
export type VaccineReminderDay = (typeof VACCINE_REMINDER_DAYS)[number]

export interface ReminderVaccine {
  name?: string
  /** Fecha del próximo refuerzo, `YYYY-MM-DD`, o '' si la familia no la anotó. */
  nextDue?: string
}

export interface ReminderDog {
  id: string
  ownerId: string
  name: string
  vaccines: readonly ReminderVaccine[]
}

export interface VaccineReminder {
  /** A quién se le manda: quien es dueño del perro. */
  uid: string
  dogId: string
  dogName: string
  /** Cuántos días faltan: 7 o 0. */
  daysLeft: VaccineReminderDay
  /** La fecha del refuerzo que se avisa, que también identifica el aviso. */
  dueDate: string
  title: string
  body: string
  url: string
}

/**
 * Una fecha que existe en el calendario. `daysBetweenDates` sólo revisa la forma,
 * así que "2026-08-60" pasaba y se normalizaba a otro día: podía avisar un
 * refuerzo que nadie anotó.
 */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function bodyFor(dogName: string, daysLeft: VaccineReminderDay): string {
  const who = dogName.trim() ? dogName.trim() : 'tu perro'
  return daysLeft === 0
    ? `Hoy toca el refuerzo de ${who}, según la fecha que anotaste. Si ya se lo aplicaron, actualiza la fecha en su perfil.`
    : `El refuerzo de ${who} toca en 7 días, según la fecha que anotaste. Si ya se lo aplicaron, actualiza la fecha en su perfil.`
}

/**
 * Un aviso por perro y por umbral, aunque tenga dos vacunas para el mismo día:
 * es la misma visita al veterinario. Un perro con fechas en días distintos
 * recibe un aviso por cada día que llegue a un umbral.
 */
export function buildVaccineReminders(dogs: readonly ReminderDog[], today: string): VaccineReminder[] {
  const reminders: VaccineReminder[] = []
  for (const dog of dogs) {
    if (!dog.ownerId) continue
    const seen = new Set<string>()
    for (const vaccine of dog.vaccines) {
      const dueDate = typeof vaccine.nextDue === 'string' && isRealDate(vaccine.nextDue) ? vaccine.nextDue : ''
      const daysLeft = dueDate ? daysBetweenDates(today, dueDate) : null
      if (daysLeft === null) continue
      if (!(VACCINE_REMINDER_DAYS as readonly number[]).includes(daysLeft)) continue
      const key = `${dueDate}:${daysLeft}`
      if (seen.has(key)) continue
      seen.add(key)
      reminders.push({
        uid: dog.ownerId,
        dogId: dog.id,
        dogName: dog.name,
        daysLeft: daysLeft as VaccineReminderDay,
        dueDate,
        title: daysLeft === 0 ? 'Hoy toca un refuerzo' : 'Se acerca un refuerzo',
        body: bodyFor(dog.name, daysLeft as VaccineReminderDay),
        url: `/familia/perros/${dog.id}`,
      })
    }
  }
  return reminders
}

/**
 * El identificador del aviso, para no mandarlo dos veces. Lleva la fecha: si la
 * familia corrige la fecha, es otro refuerzo y otro aviso.
 */
export function vaccineReminderMarker(reminder: Pick<VaccineReminder, 'dogId' | 'dueDate' | 'daysLeft'>): string {
  return `vaccine_${reminder.dogId}_${reminder.dueDate}_${reminder.daysLeft}`
}
