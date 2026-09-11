import { daysBetweenDates } from '@/lib/customerSegments'

/**
 * Lo que un admin tiene que ver de la salud de un perro de un vistazo.
 *
 * Families record allergies, medication, vaccines and special needs in their
 * panel. A vaccine is called overdue only when the family wrote down its
 * booster date: no validity period is assumed from the vaccine's name -- that
 * is the vet's call, and guessing it would put a false "vencida" on a dog.
 */

export const VACCINE_DUE_SOON_DAYS = 30

export interface DogVaccine {
  name: string
  /** Fecha de aplicación, `YYYY-MM-DD` o ''. */
  date: string
  /** Fecha del próximo refuerzo, `YYYY-MM-DD` o ''. */
  nextDue: string
}

export interface DogHealthFields {
  allergies: readonly string[]
  medications: readonly string[]
  vaccines: readonly DogVaccine[]
  specialNeeds: string
}

export type VaccineStatus = 'vencida' | 'por_vencer' | 'vigente' | 'sin_refuerzo'

export const VACCINE_STATUS_LABELS: Record<VaccineStatus, string> = {
  vencida: 'Refuerzo vencido',
  por_vencer: 'Refuerzo próximo',
  vigente: 'Al día',
  sin_refuerzo: 'Sin fecha de refuerzo',
}

export function vaccineStatus(vaccine: Pick<DogVaccine, 'nextDue'>, today: string): VaccineStatus {
  const daysLeft = vaccine.nextDue ? daysBetweenDates(today, vaccine.nextDue) : null
  if (daysLeft === null) return 'sin_refuerzo'
  if (daysLeft < 0) return 'vencida'
  return daysLeft <= VACCINE_DUE_SOON_DAYS ? 'por_vencer' : 'vigente'
}

export type DogAlertKey = 'alergias' | 'medicamento' | 'vacuna_vencida' | 'vacuna_por_vencer' | 'cuidados'

export interface DogAlert {
  key: DogAlertKey
  label: string
  detail: string
  tone: 'danger' | 'warning' | 'info'
}

export function dogAlerts(dog: DogHealthFields, today: string): DogAlert[] {
  const alerts: DogAlert[] = []
  if (dog.allergies.length > 0) {
    alerts.push({ key: 'alergias', label: 'Alergias', detail: dog.allergies.join(', '), tone: 'danger' })
  }
  if (dog.medications.length > 0) {
    alerts.push({ key: 'medicamento', label: 'Medicamento', detail: dog.medications.join(', '), tone: 'warning' })
  }
  const overdue = dog.vaccines.filter((vaccine) => vaccineStatus(vaccine, today) === 'vencida').map((vaccine) => vaccine.name)
  if (overdue.length > 0) {
    alerts.push({ key: 'vacuna_vencida', label: VACCINE_STATUS_LABELS.vencida, detail: overdue.join(', '), tone: 'danger' })
  }
  const dueSoon = dog.vaccines.filter((vaccine) => vaccineStatus(vaccine, today) === 'por_vencer').map((vaccine) => vaccine.name)
  if (dueSoon.length > 0) {
    alerts.push({ key: 'vacuna_por_vencer', label: VACCINE_STATUS_LABELS.por_vencer, detail: dueSoon.join(', '), tone: 'warning' })
  }
  if (dog.specialNeeds.trim()) {
    alerts.push({ key: 'cuidados', label: 'Cuidados especiales', detail: dog.specialNeeds.trim(), tone: 'info' })
  }
  return alerts
}
