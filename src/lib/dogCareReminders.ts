import { daysBetweenDates } from '@/lib/customerSegments'
import { vaccineStatus, type DogVaccine } from '@/lib/dogHealth'

/**
 * El refuerzo que se acerca, dicho a quien puede llevarlo al veterinario.
 *
 * La fecha del próximo refuerzo la escribe la familia en el perfil de su
 * perro, y hasta ahora sólo la veía administración: en el panel de Perros y en
 * Insights. La familia la escribía y no la volvía a ver nunca. Eso convierte un
 * dato útil en un dato muerto.
 *
 * Aquí se convierte en un recordatorio. No se inventa ninguna vigencia: si la
 * familia no anotó la fecha del refuerzo, no hay nada que recordar. Cuándo toca
 * cada vacuna lo decide el veterinario, no esta app.
 */

/** Sólo lo que hay que hacer algo al respecto. */
export type CareUrgency = 'vencida' | 'por_vencer'

export interface CareDog {
  id: string
  name: string
  breed: string
  photoReference?: string
  vaccines: readonly DogVaccine[]
}

export interface CareReminder {
  dogId: string
  dogName: string
  breed: string
  urgency: CareUrgency
  /** Los nombres de las vacunas que aplican, tal como las escribió la familia. */
  vaccines: string[]
  /** La fecha más próxima entre ellas, `YYYY-MM-DD`. */
  dueDate: string
  /** Días que faltan; negativo si ya pasó. */
  daysLeft: number
}

/**
 * Un renglón por perro, el más urgente primero. Un perro con un refuerzo
 * vencido y otro por vencer sale una sola vez, como vencido: es la misma visita
 * al veterinario.
 */
export function careReminders(dogs: readonly CareDog[], today: string): CareReminder[] {
  const reminders: CareReminder[] = []

  for (const dog of dogs) {
    const pending = dog.vaccines
      .map((vaccine) => ({ vaccine, status: vaccineStatus(vaccine, today) }))
      .filter((entry) => entry.status === 'vencida' || entry.status === 'por_vencer')
    if (pending.length === 0) continue

    const urgency: CareUrgency = pending.some((entry) => entry.status === 'vencida') ? 'vencida' : 'por_vencer'
    const applicable = pending.filter((entry) => entry.status === urgency)
    const dueDate = applicable
      .map((entry) => entry.vaccine.nextDue)
      .sort((a, b) => a.localeCompare(b))[0]

    reminders.push({
      dogId: dog.id,
      dogName: dog.name,
      breed: dog.breed,
      urgency,
      vaccines: applicable.map((entry) => entry.vaccine.name).filter(Boolean),
      dueDate,
      daysLeft: daysBetweenDates(today, dueDate) ?? 0,
    })
  }

  return reminders.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'vencida' ? -1 : 1
    return a.dueDate.localeCompare(b.dueDate)
  })
}

/** Cómo se dice en una línea, sin alarmar de más ni de menos. */
export function careReminderLabel(reminder: CareReminder): string {
  const names = reminder.vaccines.length > 0 ? reminder.vaccines.join(', ') : 'Su refuerzo'
  if (reminder.urgency === 'vencida') {
    const days = Math.abs(reminder.daysLeft)
    return `${names}: el refuerzo venció hace ${days} ${days === 1 ? 'día' : 'días'}.`
  }
  if (reminder.daysLeft === 0) return `${names}: el refuerzo toca hoy.`
  if (reminder.daysLeft === 1) return `${names}: el refuerzo toca mañana.`
  return `${names}: el refuerzo toca en ${reminder.daysLeft} días.`
}
