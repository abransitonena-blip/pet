import { dateInTimezone } from '@/lib/bookingSchedule'
import { CANCELLED_STATUSES, COMPLETED_STATUSES, UPCOMING_STATUSES } from '@/lib/businessMetrics'

/**
 * Segmentos de familias para /admin/clientes.
 *
 * The previous classification put families in the wrong bucket in four ways:
 * - "último paseo" was the newest session of any status, so a cancelled walk
 *   or one booked for next week read as a recent visit;
 * - VIP and Frecuente never lapsed: ten walks and gone for months still read
 *   as VIP, never as at risk;
 * - "Nuevo" meant "under three walks, one of them recent", not a new account;
 * - "today" was the UTC date, which is already tomorrow on Mexico City evenings.
 *
 * Stage (how recently the family walked) and loyalty (how many walks it has
 * completed) are now separate, so a VIP family at risk -- the one most worth a
 * call -- shows as exactly that. The 30/60-day windows and the 3/10-walk
 * thresholds are the ones this page already used.
 */

export const SEGMENT_WINDOWS = { newAccountDays: 30, activeDays: 30, atRiskDays: 60 } as const
export const LOYALTY_THRESHOLDS = { frequent: 3, vip: 10 } as const

export type LifecycleSegment = 'nueva' | 'activa' | 'en_riesgo' | 'inactiva' | 'sin_paseos'
export type LoyaltyTier = 'vip' | 'frecuente' | null

export const SEGMENT_ORDER: readonly LifecycleSegment[] = ['nueva', 'activa', 'en_riesgo', 'inactiva', 'sin_paseos']

export const SEGMENT_INFO: Record<LifecycleSegment, { label: string; rule: string; action: string }> = {
  nueva: {
    label: 'Nueva',
    rule: `Se registró en los últimos ${SEGMENT_WINDOWS.newAccountDays} días.`,
    action: 'Dale la bienvenida y ayúdale a agendar su primer paseo.',
  },
  activa: {
    label: 'Activa',
    rule: `Completó un paseo en los últimos ${SEGMENT_WINDOWS.activeDays} días o tiene uno agendado.`,
    action: 'Va bien. Pregúntale cómo le fue en el último paseo.',
  },
  en_riesgo: {
    label: 'En riesgo',
    rule: `Su último paseo fue hace ${SEGMENT_WINDOWS.activeDays + 1} a ${SEGMENT_WINDOWS.atRiskDays} días y no tiene otro agendado.`,
    action: 'Escríbele antes de que deje de reservar.',
  },
  inactiva: {
    label: 'Inactiva',
    rule: `Su último paseo fue hace más de ${SEGMENT_WINDOWS.atRiskDays} días y no tiene otro agendado.`,
    action: 'Invítale a volver con un mensaje personal.',
  },
  sin_paseos: {
    label: 'Sin paseos',
    rule: 'Nunca ha completado un paseo ni tiene uno agendado.',
    action: 'Pregúntale qué le faltó para reservar.',
  },
}

export const LOYALTY_INFO: Record<'vip' | 'frecuente', { label: string; rule: string }> = {
  vip: { label: 'VIP', rule: `${LOYALTY_THRESHOLDS.vip} o más paseos completados.` },
  frecuente: { label: 'Frecuente', rule: `De ${LOYALTY_THRESHOLDS.frequent} a ${LOYALTY_THRESHOLDS.vip - 1} paseos completados.` },
}

export interface SegmentSession {
  date: string
  status: string
}

export interface CustomerActivity {
  segment: LifecycleSegment
  loyalty: LoyaltyTier
  completedCount: number
  cancelledCount: number
  upcomingCount: number
  /** `YYYY-MM-DD`, or '' when the family has never completed a walk. */
  lastCompletedDate: string
  /** `YYYY-MM-DD` of the next booked walk, or ''. */
  nextWalkDate: string
  daysSinceLastWalk: number | null
  /** `YYYY-MM-DD` in Mexico City, or '' when the profile has no creation date. */
  registeredDate: string
  avgFrequencyDays: number | null
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Whole days from `from` to `to` (both `YYYY-MM-DD`); negative when `to` is earlier. */
export function daysBetweenDates(from: string, to: string): number | null {
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) return null
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000)
}

/** Today's date in Mexico City, the calendar walks are booked in. */
export function mexicoCityToday(now: Date = new Date()): string {
  return dateInTimezone(now.getTime())
}

export function timestampToMexicoCityDate(value: { seconds: number } | null | undefined): string {
  return value && Number.isFinite(value.seconds) ? dateInTimezone(value.seconds * 1000) : ''
}

export function describeDaysAgo(days: number | null): string {
  if (days === null) return 'Sin paseos completados'
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.round(days / 7)} sem`
  if (days < 365) {
    const months = Math.round(days / 30)
    return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  }
  const years = Math.round(days / 365)
  return `Hace ${years} ${years === 1 ? 'año' : 'años'}`
}

const SHORT_DATE = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** `YYYY-MM-DD` as "10 sept 2026"; the calendar date as written, with no timezone shift. */
export function formatShortDate(date: string): string {
  if (!DATE_PATTERN.test(date)) return ''
  const [year, month, day] = date.split('-').map(Number)
  return SHORT_DATE.format(new Date(Date.UTC(year, month - 1, day)))
}

export function customerActivity(
  sessions: readonly SegmentSession[],
  registeredDate: string,
  today: string,
): CustomerActivity {
  const completed = sessions
    .filter((session) => COMPLETED_STATUSES.has(session.status) && DATE_PATTERN.test(session.date) && session.date <= today)
    .map((session) => session.date)
    .sort()
  const upcoming = sessions
    .filter((session) => UPCOMING_STATUSES.has(session.status) && DATE_PATTERN.test(session.date) && session.date >= today)
    .map((session) => session.date)
    .sort()
  const lastCompletedDate = completed[completed.length - 1] ?? ''
  const daysSinceLastWalk = lastCompletedDate ? daysBetweenDates(lastCompletedDate, today) : null
  const accountAgeDays = registeredDate ? daysBetweenDates(registeredDate, today) : null
  const avgFrequencyDays = completed.length > 1
    ? Math.round((daysBetweenDates(completed[0], lastCompletedDate) ?? 0) / (completed.length - 1))
    : null

  let segment: LifecycleSegment = 'sin_paseos'
  if (accountAgeDays !== null && accountAgeDays <= SEGMENT_WINDOWS.newAccountDays) segment = 'nueva'
  else if (upcoming.length > 0 || (daysSinceLastWalk !== null && daysSinceLastWalk <= SEGMENT_WINDOWS.activeDays)) segment = 'activa'
  else if (daysSinceLastWalk !== null) segment = daysSinceLastWalk <= SEGMENT_WINDOWS.atRiskDays ? 'en_riesgo' : 'inactiva'

  const loyalty: LoyaltyTier = completed.length >= LOYALTY_THRESHOLDS.vip
    ? 'vip'
    : completed.length >= LOYALTY_THRESHOLDS.frequent ? 'frecuente' : null

  return {
    segment,
    loyalty,
    completedCount: completed.length,
    cancelledCount: sessions.filter((session) => CANCELLED_STATUSES.has(session.status)).length,
    upcomingCount: upcoming.length,
    lastCompletedDate,
    nextWalkDate: upcoming[0] ?? '',
    daysSinceLastWalk,
    registeredDate,
    avgFrequencyDays,
  }
}

/** First word of a family's name, or '' for the directory's "Sin nombre" placeholder. */
export function firstNameOf(name: string): string {
  const trimmed = name.trim()
  return trimmed === 'Sin nombre' ? '' : trimmed.split(/\s+/)[0] ?? ''
}

export function joinNames(names: readonly string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean)
  if (clean.length <= 1) return clean[0] ?? ''
  return `${clean.slice(0, -1).join(', ')} y ${clean[clean.length - 1]}`
}

/** First WhatsApp line for each stage. It never promises a discount or a price. */
export function segmentMessage(segment: LifecycleSegment, customerName: string, dogNames: readonly string[]): string {
  const firstName = firstNameOf(customerName)
  const hello = firstName ? `Hola ${firstName}, somos PET Ap.` : 'Hola, somos PET Ap.'
  const dogs = joinNames(dogNames)
  switch (segment) {
    case 'nueva':
      return `${hello} Gracias por registrarte. ¿Te ayudamos a agendar el primer paseo${dogs ? ` de ${dogs}` : ''}?`
    case 'activa':
      return `${hello} ¿Cómo les fue en el último paseo${dogs ? ` de ${dogs}` : ''}?`
    case 'en_riesgo':
      return `${hello} Hace unas semanas que no paseamos${dogs ? ` a ${dogs}` : ''}. ¿Te agendamos un paseo?`
    case 'inactiva':
      return `${hello} Nos encantaría volver a pasear${dogs ? ` a ${dogs}` : ''}. ¿Te agendamos un paseo?`
    case 'sin_paseos':
      return `${hello} Vimos que aún no agendas tu primer paseo. ¿Te podemos ayudar con algo?`
  }
}
