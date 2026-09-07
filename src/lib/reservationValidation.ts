import type { ReservationPackageType } from '@/lib/walkServices'

export type ReservationStepId = 'service' | 'details' | 'schedule' | 'confirm'

export interface ReservationValidationInput {
  petId: string
  addressId: string
  zoneId?: string
  zoneActive?: boolean
  whenType: 'asap' | 'scheduled'
  date: string
  windowStart: string
  windowEnd: string
  serviceId: string
  serviceName: string
  servicePackageType: ReservationPackageType | ''
  serviceAmountCents: number | null
  serviceVersion: number | null
  serviceComplimentary: boolean
  serviceDurationMinutes: number | null
}

export interface ReservationValidationIssue {
  field: string
  step: ReservationStepId
  label: string
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function timeToMinutes(value: string): number | null {
  if (!TIME_PATTERN.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return (hours * 60) + minutes
}

export function isValidSameDayWindow(start: string, end: string): boolean {
  const startMinutes = timeToMinutes(start)
  const endMinutes = timeToMinutes(end)
  return startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
}

export function getReservationValidationIssues(form: ReservationValidationInput): ReservationValidationIssue[] {
  const issues: ReservationValidationIssue[] = []
  if (!form.petId) issues.push({ field: 'petId', step: 'details', label: 'Selecciona un perro' })
  if (!form.addressId) issues.push({ field: 'addressId', step: 'details', label: 'Selecciona una dirección' })
  else if (!form.zoneId) issues.push({ field: 'zoneId', step: 'details', label: 'La dirección necesita una zona disponible' })
  else if (!form.zoneActive) issues.push({ field: 'zoneId', step: 'details', label: 'La zona de esta dirección ya no está disponible' })
  if (form.whenType !== 'scheduled') {
    issues.push({ field: 'whenType', step: 'schedule', label: 'Elige una fecha y horario programados' })
  } else {
    if (!form.date) issues.push({ field: 'date', step: 'schedule', label: 'Selecciona una fecha' })
    if (!form.windowStart) issues.push({ field: 'windowStart', step: 'schedule', label: 'Selecciona un horario' })
    if (!form.windowEnd) issues.push({ field: 'windowEnd', step: 'schedule', label: 'El horario no tiene una duración válida' })
    if (form.windowStart && form.windowEnd && !isValidSameDayWindow(form.windowStart, form.windowEnd)) {
      issues.push({ field: 'timeWindow', step: 'schedule', label: 'La hora final debe ser posterior a la hora inicial' })
    } else if (form.windowStart && form.windowEnd && form.serviceDurationMinutes !== null
      && Number(timeToMinutes(form.windowEnd)) - Number(timeToMinutes(form.windowStart)) !== form.serviceDurationMinutes) {
      issues.push({ field: 'timeWindow', step: 'schedule', label: 'El horario no coincide con la duración del servicio' })
    }
  }
  if (!form.serviceId || !form.serviceName || !form.servicePackageType) {
    issues.push({ field: 'serviceId', step: 'service', label: 'Selecciona un servicio disponible' })
  } else if (form.serviceAmountCents === null || !Number.isSafeInteger(form.serviceAmountCents) || form.serviceAmountCents < 0) {
    issues.push({ field: 'servicePrice', step: 'service', label: 'El servicio seleccionado no tiene precio configurado' })
  } else if (form.serviceAmountCents === 0 && !form.serviceComplimentary) {
    issues.push({ field: 'servicePrice', step: 'service', label: 'La cortesía del servicio no está confirmada' })
  }
  if (form.serviceId && (!Number.isSafeInteger(form.serviceVersion) || Number(form.serviceVersion) < 1)) {
    issues.push({ field: 'serviceVersion', step: 'service', label: 'La versión del servicio no está disponible' })
  }
  if (form.serviceId && (!Number.isSafeInteger(form.serviceDurationMinutes) || Number(form.serviceDurationMinutes) <= 0)) {
    issues.push({ field: 'serviceDuration', step: 'service', label: 'El servicio no tiene duración configurada' })
  }
  if (form.servicePackageType === 'weekly') {
    issues.push({ field: 'weeklySchedule', step: 'service', label: 'La programación semanal aún no está disponible' })
  }
  return issues
}
