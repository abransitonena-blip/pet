import type { CanonicalReservationView } from '@/lib/useCanonicalReservations'
import type { PublicServicePrice } from '@/lib/servicePricing'
import { getReservationServiceDefinitions, OFFERED_SERVICE_IDS } from '@/lib/walkServices'

/**
 * Cifras del negocio a partir de los paseos canónicos.
 *
 * Finanzas, Analítica and Insights all summed the legacy `reservations`
 * collection, which nothing has written to since the migration, so every
 * figure read zero while real bookings sat in `walkSessions`.
 *
 * Money is the delicate part. A session records which plan and which
 * *version* of its tariff was booked, but no amount, and only the current
 * version of each tariff is kept. So a session is valued at the published
 * tariff only when it was booked on that same version. One booked on an
 * older version has an unknown value and is counted apart -- it is never
 * silently re-priced at today's tariff.
 */

export const COMPLETED_STATUSES: ReadonlySet<string> = new Set(['completed'])
export const CANCELLED_STATUSES: ReadonlySet<string> = new Set(['cancelled', 'no_show'])
export const UNASSIGNED_STATUSES: ReadonlySet<string> = new Set(['requested', 'pending_assignment'])
export const UPCOMING_STATUSES: ReadonlySet<string> = new Set([
  'requested', 'pending_assignment', 'assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress',
])

export const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitado',
  pending_assignment: 'Por asignar',
  assigned: 'Asignado',
  confirmed: 'Confirmado',
  on_the_way: 'En camino',
  arrived: 'En el domicilio',
  in_progress: 'En paseo',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No se presentó',
}

export interface ValuedSession extends CanonicalReservationView {
  /** Centavos según la tarifa reservada, o null si no se puede verificar. */
  valueCents: number | null
}

export function sessionValueCents(
  session: Pick<CanonicalReservationView, 'serviceId' | 'serviceVersion'>,
  services: Record<string, PublicServicePrice>,
): number | null {
  const price = services[session.serviceId]
  if (!price || price.amountCents === null) return null
  if (session.serviceVersion === null || price.version !== session.serviceVersion) return null
  return price.amountCents
}

export function valueSessions(
  sessions: readonly CanonicalReservationView[],
  services: Record<string, PublicServicePrice>,
): ValuedSession[] {
  return sessions.map((session) => ({ ...session, valueCents: sessionValueCents(session, services) }))
}

export interface ValueTotal {
  /** Suma de los paseos con valor verificable. */
  cents: number
  counted: number
  /** Paseos sin valor verificable: tarifa anterior o sin tarifa. */
  unknown: number
}

export function totalValue(sessions: readonly ValuedSession[]): ValueTotal {
  return sessions.reduce<ValueTotal>((total, session) => (session.valueCents === null
    ? { ...total, unknown: total.unknown + 1 }
    : { cents: total.cents + session.valueCents, counted: total.counted + 1, unknown: total.unknown }),
  { cents: 0, counted: 0, unknown: 0 })
}

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatMxn(cents: number): string {
  return MXN.format(cents / 100)
}

/** Offered plans with no published tariff -- the only pricing gap worth warning about. */
export function offeredPlansWithoutPrice(services: Record<string, PublicServicePrice>): string[] {
  const names = new Map(getReservationServiceDefinitions().map((definition) => [definition.id, definition.name]))
  return OFFERED_SERVICE_IDS
    .filter((id) => !services[id] || services[id].amountCents === null)
    .map((id) => names.get(id) ?? id)
}

/** Local calendar date `days` ago as `YYYY-MM-DD`, the format of scheduledDate. */
export function localDateDaysAgo(days: number, from: Date = new Date()): string {
  const date = new Date(from)
  date.setDate(date.getDate() - days)
  return date.toLocaleDateString('en-CA')
}

/**
 * Percent change, or null when there is no previous figure to compare with:
 * going from 0 to anything is not "+100%", it is simply new.
 */
export function growthPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}
