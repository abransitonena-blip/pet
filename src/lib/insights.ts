import type { CanonicalReservationView } from '@/lib/useCanonicalReservations'
import type { DirectoryCustomer, DirectoryDog } from '@/lib/useCanonicalDirectory'
import type { PublicServicePrice } from '@/lib/servicePricing'
import {
  CANCELLED_STATUSES,
  COMPLETED_STATUSES,
  STATUS_LABELS,
  UNASSIGNED_STATUSES,
  UPCOMING_STATUSES,
  growthPercent,
  offeredPlansWithoutPrice,
  totalValue,
  valueSessions,
  type ValueTotal,
} from '@/lib/businessMetrics'
import {
  LOYALTY_THRESHOLDS,
  SEGMENT_WINDOWS,
  customerActivity,
  daysBetweenDates,
  describeDaysAgo,
  formatShortDate,
  timestampToMexicoCityDate,
  type CustomerActivity,
} from '@/lib/customerSegments'
import { dogAlerts, type DogAlertKey } from '@/lib/dogHealth'

/**
 * Centro de Insights: qué merece atención, calculado solo con datos reales.
 *
 * Each insight counts concrete walks, families or dogs and lists them by name,
 * so an admin can act on it instead of reading a vague warning. Patterns (peak
 * day, cancellations, growth, lead time) only appear once there are enough
 * walks to mean something. The thresholds are the ones this page already used,
 * and money follows Finanzas' rule: a walk counts only at the tariff version
 * it was booked on.
 */

export type InsightCategory = 'operacion' | 'seguridad' | 'familias' | 'demanda'
export type InsightPriority = 'high' | 'medium' | 'low'

export const INSIGHT_CATEGORY_ORDER: readonly InsightCategory[] = ['operacion', 'seguridad', 'familias', 'demanda']

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  operacion: 'Operación',
  seguridad: 'Seguridad',
  familias: 'Familias',
  demanda: 'Demanda y valor',
}

export const INSIGHT_LIMITS = {
  /** Fewest walks (or families) before something is called a pattern. */
  minSample: 5,
  cancelRatePercent: 15,
  lowRetentionPercent: 30,
  goodRetentionPercent: 50,
  growthPercent: 10,
  overloadWalksPerDay: 6,
  /** "Próximos días" for unassigned walks and dogs that need care. */
  aheadDays: 7,
  /** Completed walks this recent are checked for a sent report. */
  reportCheckDays: 7,
  maxReportChecks: 50,
  maxItems: 5,
} as const

export interface InsightItem {
  label: string
  detail?: string
}

export interface Insight {
  id: string
  category: InsightCategory
  priority: InsightPriority
  title: string
  description: string
  items: InsightItem[]
  /** How many more affected entries exist beyond `items`. */
  more: number
  action?: { label: string; href: string }
}

export interface OpenGeofenceAlertInput {
  sessionId: string
  walkerName: string
  zoneName: string
  distanceMeters: number | null
}

export interface InsightInputs {
  sessions: readonly CanonicalReservationView[]
  customers: readonly DirectoryCustomer[]
  dogs: readonly DirectoryDog[]
  services: Record<string, PublicServicePrice>
  /** False while tariffs load, so a missing price is not reported by mistake. */
  pricesLoaded: boolean
  /** Session ids with a sent report; null while unknown. */
  submittedReportIds: ReadonlySet<string> | null
  /** Open "salió de la zona" alerts; null while unknown. */
  openGeofenceAlerts: readonly OpenGeofenceAlertInput[] | null
  /** Nombre de zona por dirección (useCanonicalAddressZones); null mientras no se conoce. */
  zonesByAddress: Record<string, string> | null
  today: string
  periodDays: number
}

export interface PlanRow {
  name: string
  walks: number
  completed: number
  cents: number
}

export interface ZoneRow {
  zone: string
  walks: number
  completed: number
  cancelled: number
}

/** Lo que devuelve useCanonicalAddressZones cuando la dirección no tiene zona. */
export const ZONE_UNDEFINED = 'Zona no definida'
/** No pudimos leer la dirección de ese paseo, así que su zona no se sabe. */
export const ZONE_UNKNOWN = 'Zona desconocida'

export interface InsightResult {
  metrics: { walks: number; completed: number; value: ValueTotal; cancelRate: number }
  insights: Insight[]
  plans: PlanRow[]
  zones: ZoneRow[]
}

const PRIORITY_ORDER: Record<InsightPriority, number> = { high: 0, medium: 1, low: 2 }
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const ON_THE_ROAD: ReadonlySet<string> = new Set(['on_the_way', 'arrived', 'in_progress'])
const CARE_ALERTS: ReadonlySet<DogAlertKey> = new Set<DogAlertKey>(['alergias', 'medicamento', 'vacuna_vencida', 'cuidados'])
const BOOSTER_ALERTS: ReadonlySet<DogAlertKey> = new Set<DogAlertKey>(['vacuna_vencida', 'vacuna_por_vencer'])

/** `YYYY-MM-DD` moved by whole days, on the calendar (no timezone involved). */
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function weekdayOf(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function listed<T>(list: readonly T[], toItem: (entry: T) => InsightItem): Pick<Insight, 'items' | 'more'> {
  return {
    items: list.slice(0, INSIGHT_LIMITS.maxItems).map(toItem),
    more: Math.max(0, list.length - INSIGHT_LIMITS.maxItems),
  }
}

const NO_ITEMS: Pick<Insight, 'items' | 'more'> = { items: [], more: 0 }

function byDateAsc(a: CanonicalReservationView, b: CanonicalReservationView): number {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
}

function sessionItem(session: CanonicalReservationView): InsightItem {
  return {
    label: `${formatShortDate(session.date)}${session.time ? ` ${session.time}` : ''}`,
    detail: [
      session.petName || 'Perro sin nombre',
      session.name || 'Familia sin nombre',
      STATUS_LABELS[session.status] ?? session.status,
    ].join(' · '),
  }
}

function familyItem(activity: CustomerActivity & { customer: DirectoryCustomer }): InsightItem {
  return {
    label: activity.customer.name,
    detail: activity.daysSinceLastWalk === null
      ? 'Sin paseos completados'
      : `Último paseo ${describeDaysAgo(activity.daysSinceLastWalk).toLowerCase()} · ${plural(activity.completedCount, 'paseo', 'paseos')}`,
  }
}

function top(counts: Map<string, number>): [string, number] | undefined {
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

/** Completed walks from the last few days whose report the page checks. */
export function reportCheckSessionIds(sessions: readonly CanonicalReservationView[], today: string): string[] {
  const since = shiftDate(today, -(INSIGHT_LIMITS.reportCheckDays - 1))
  return sessions
    .filter((session) => COMPLETED_STATUSES.has(session.status) && session.date >= since && session.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, INSIGHT_LIMITS.maxReportChecks)
    .map((session) => session.id)
}

export function computeInsights(input: InsightInputs): InsightResult {
  const { sessions, customers, dogs, services, pricesLoaded, submittedReportIds, openGeofenceAlerts, zonesByAddress, today, periodDays } = input
  const limits = INSIGHT_LIMITS
  const valued = valueSessions(sessions, services)
  const start = shiftDate(today, -(periodDays - 1))
  const previousStart = shiftDate(today, -(periodDays * 2 - 1))
  const aheadEnd = shiftDate(today, limits.aheadDays)

  const inPeriod = valued.filter((session) => session.date >= start && session.date <= today)
  const inPrevious = valued.filter((session) => session.date >= previousStart && session.date < start)
  const completed = inPeriod.filter((session) => COMPLETED_STATUSES.has(session.status))
  const value = totalValue(completed)
  const previousValue = totalValue(inPrevious.filter((session) => COMPLETED_STATUSES.has(session.status)))
  const cancelledInPeriod = inPeriod.filter((session) => CANCELLED_STATUSES.has(session.status))
  const cancelRate = inPeriod.length > 0 ? Math.round((cancelledInPeriod.length / inPeriod.length) * 100) : 0
  const active = inPeriod.filter((session) => !CANCELLED_STATUSES.has(session.status))
  const previousActive = inPrevious.filter((session) => !CANCELLED_STATUSES.has(session.status))

  const insights: Insight[] = []
  const add = (insight: Insight) => { insights.push(insight) }
  const toRequests = { label: 'Ir a solicitudes', href: '/admin/reservas' }
  const toRoutes = { label: 'Ver rutas', href: '/admin/rutas' }
  const toFamilies = { label: 'Ver familias', href: '/admin/clientes' }
  const toDogs = { label: 'Ver perros', href: '/admin/perros' }

  // ── Operación ────────────────────────────────────────────────────────────
  const unassignedToday = valued.filter((session) => session.date === today && UNASSIGNED_STATUSES.has(session.status)).sort(byDateAsc)
  if (unassignedToday.length > 0) {
    add({
      id: 'unassigned-today',
      category: 'operacion',
      priority: 'high',
      title: `${plural(unassignedToday.length, 'paseo', 'paseos')} de hoy sin paseador`,
      description: 'Tienen fecha de hoy y todavía nadie los ha tomado. Asígnalos antes de la ventana de llegada.',
      ...listed(unassignedToday, sessionItem),
      action: toRequests,
    })
  }

  const staleOpen = valued
    .filter((session) => session.date < today && UPCOMING_STATUSES.has(session.status))
    .sort((a, b) => b.date.localeCompare(a.date))
  if (staleOpen.length > 0) {
    add({
      id: 'stale-open',
      category: 'operacion',
      priority: 'high',
      title: `${plural(staleOpen.length, 'paseo pasado', 'paseos pasados')} sin cerrar`,
      description: 'Su fecha ya pasó y siguen abiertos. Márcalos como completados, cancelados o "no se presentó" para que las cifras sean reales.',
      ...listed(staleOpen, sessionItem),
      action: toRequests,
    })
  }

  const walkerLoads = new Map<string, { name: string; count: number }>()
  for (const session of valued) {
    if (session.date !== today || !session.assignedWalker || CANCELLED_STATUSES.has(session.status)) continue
    const entry = walkerLoads.get(session.assignedWalker) ?? { name: session.walkerName || 'Paseador sin nombre', count: 0 }
    entry.count += 1
    walkerLoads.set(session.assignedWalker, entry)
  }
  const overloaded = Array.from(walkerLoads.values()).filter((walker) => walker.count > limits.overloadWalksPerDay)
  if (overloaded.length > 0) {
    add({
      id: 'overloaded',
      category: 'operacion',
      priority: 'high',
      title: 'Paseadores con carga alta hoy',
      description: `Tienen más de ${limits.overloadWalksPerDay} paseos hoy. Reparte alguno para no llegar tarde.`,
      ...listed(overloaded, (walker) => ({ label: walker.name, detail: plural(walker.count, 'paseo', 'paseos') })),
      action: { label: 'Ver paseadores', href: '/admin/paseadores' },
    })
  }

  const missingPrices = pricesLoaded ? offeredPlansWithoutPrice(services) : []
  if (missingPrices.length > 0) {
    add({
      id: 'missing-prices',
      category: 'operacion',
      priority: 'high',
      title: `Falta tarifa: ${missingPrices.join(', ')}`,
      description: 'Las familias no pueden reservar un plan sin tarifa publicada, y sus paseos no suman valor.',
      ...NO_ITEMS,
      action: { label: 'Configurar precios', href: '/admin/config' },
    })
  }

  const unassignedSoon = valued
    .filter((session) => session.date > today && session.date <= aheadEnd && UNASSIGNED_STATUSES.has(session.status))
    .sort(byDateAsc)
  if (unassignedSoon.length > 0) {
    add({
      id: 'unassigned-week',
      category: 'operacion',
      priority: 'medium',
      title: `${plural(unassignedSoon.length, 'paseo', 'paseos')} de los próximos ${limits.aheadDays} días sin paseador`,
      description: 'Asignarlos con anticipación deja margen para reprogramar si nadie está disponible.',
      ...listed(unassignedSoon, sessionItem),
      action: toRequests,
    })
  }

  if (submittedReportIds) {
    const checked = new Set(reportCheckSessionIds(sessions, today))
    const pendingReports = valued
      .filter((session) => checked.has(session.id) && !submittedReportIds.has(session.id))
      .sort((a, b) => b.date.localeCompare(a.date))
    if (pendingReports.length > 0) {
      add({
        id: 'reports-pending',
        category: 'operacion',
        priority: 'medium',
        title: `${plural(pendingReports.length, 'paseo completado', 'paseos completados')} sin reporte enviado`,
        description: `De los últimos ${limits.reportCheckDays} días. La familia ve el reporte y las fotos solo cuando el paseador lo envía.`,
        ...listed(pendingReports, (session) => ({
          label: `${formatShortDate(session.date)} · ${session.petName || 'Perro sin nombre'}`,
          detail: session.walkerName || 'Sin paseador asignado',
        })),
        action: { label: 'Ver reportes', href: '/admin/reportes' },
      })
    }
  }

  const noShows = inPeriod.filter((session) => session.status === 'no_show').sort((a, b) => b.date.localeCompare(a.date))
  if (noShows.length > 0) {
    add({
      id: 'no-shows',
      category: 'operacion',
      priority: 'medium',
      title: `${plural(noShows.length, 'paseo marcado', 'paseos marcados')} como "no se presentó"`,
      description: 'En el periodo. Habla con la familia y el paseador para que no se repita en el siguiente paseo.',
      ...listed(noShows, sessionItem),
      action: toRequests,
    })
  }

  const onTheRoad = valued.filter((session) => session.date === today && ON_THE_ROAD.has(session.status)).sort(byDateAsc)
  if (onTheRoad.length > 0) {
    add({
      id: 'on-the-road',
      category: 'operacion',
      priority: 'low',
      title: `${plural(onTheRoad.length, 'paseo', 'paseos')} en curso ahora`,
      description: 'Van en camino, ya llegaron o están paseando. Síguelos en Rutas.',
      ...listed(onTheRoad, (session) => ({
        label: session.walkerName || 'Paseador sin nombre',
        detail: `${session.petName || 'Perro sin nombre'} · ${STATUS_LABELS[session.status] ?? session.status}`,
      })),
      action: toRoutes,
    })
  }

  // ── Seguridad ────────────────────────────────────────────────────────────
  const geofence = openGeofenceAlerts ?? []
  if (geofence.length > 0) {
    add({
      id: 'geofence-open',
      category: 'seguridad',
      priority: 'high',
      title: `${plural(geofence.length, 'alerta', 'alertas')} de zona sin revisar`,
      description: 'Un paseador salió de la zona del paseo. Confírmalo con él y marca la alerta como vista en el aviso de arriba.',
      ...listed(geofence, (alert) => ({
        label: alert.walkerName,
        detail: [
          alert.zoneName ? `Zona ${alert.zoneName}` : '',
          alert.distanceMeters !== null ? `a ${alert.distanceMeters} m del centro` : '',
        ].filter(Boolean).join(' · ') || undefined,
      })),
      action: toRoutes,
    })
  }

  const dogsById = new Map(dogs.map((dog) => [dog.id, dog]))
  const customersById = new Map(customers.map((customer) => [customer.uid, customer]))
  const careItems: InsightItem[] = []
  const upcoming = valued
    .filter((session) => session.date >= today && session.date <= aheadEnd && UPCOMING_STATUSES.has(session.status))
    .sort(byDateAsc)
  for (const session of upcoming) {
    for (const dogId of session.dogIds) {
      const dog = dogsById.get(dogId)
      if (!dog) continue
      const alerts = dogAlerts(dog, today).filter((alert) => CARE_ALERTS.has(alert.key))
      if (alerts.length === 0) continue
      careItems.push({
        label: `${dog.name} · ${formatShortDate(session.date)}${session.time ? ` ${session.time}` : ''}`,
        detail: alerts.map((alert) => `${alert.label}: ${alert.detail}`).join(' · '),
      })
    }
  }
  if (careItems.length > 0) {
    add({
      id: 'care-upcoming',
      category: 'seguridad',
      priority: 'medium',
      title: `${plural(careItems.length, 'paseo próximo', 'paseos próximos')} con un perro que requiere cuidado`,
      description: `En los próximos ${limits.aheadDays} días. Confirma que el paseador conoce alergias, medicamento o cuidados especiales antes de salir.`,
      ...listed(careItems, (item) => item),
      action: toDogs,
    })
  }

  const boosterDogs = dogs.filter((dog) => dogAlerts(dog, today).some((alert) => BOOSTER_ALERTS.has(alert.key)))
  if (boosterDogs.length > 0) {
    add({
      id: 'boosters',
      category: 'seguridad',
      priority: 'low',
      title: `${plural(boosterDogs.length, 'perro', 'perros')} con refuerzo de vacuna vencido o próximo`,
      description: 'Según la fecha de refuerzo que anotó la familia. Recuérdale llevarlo al veterinario.',
      ...listed(boosterDogs, (dog) => ({
        label: dog.name,
        detail: [
          customersById.get(dog.ownerId)?.name ?? '',
          dogAlerts(dog, today).filter((alert) => BOOSTER_ALERTS.has(alert.key)).map((alert) => `${alert.label}: ${alert.detail}`).join(' · '),
        ].filter(Boolean).join(' · '),
      })),
      action: toDogs,
    })
  }

  // ── Familias ─────────────────────────────────────────────────────────────
  const sessionsByCustomer = new Map<string, CanonicalReservationView[]>()
  for (const session of sessions) {
    const bucket = sessionsByCustomer.get(session.customerId)
    if (bucket) bucket.push(session)
    else sessionsByCustomer.set(session.customerId, [session])
  }
  const dogsPerOwner = new Map<string, number>()
  for (const dog of dogs) dogsPerOwner.set(dog.ownerId, (dogsPerOwner.get(dog.ownerId) ?? 0) + 1)
  const activity = customers.map((customer) => ({
    customer,
    ...customerActivity(sessionsByCustomer.get(customer.uid) ?? [], timestampToMexicoCityDate(customer.createdAt), today),
  }))

  const vipSlipping = activity.filter((entry) => entry.loyalty === 'vip' && (entry.segment === 'en_riesgo' || entry.segment === 'inactiva'))
  if (vipSlipping.length > 0) {
    add({
      id: 'vip-slipping',
      category: 'familias',
      priority: 'high',
      title: `${plural(vipSlipping.length, 'familia VIP', 'familias VIP')} sin reservar`,
      description: `Tienen ${LOYALTY_THRESHOLDS.vip} o más paseos completados y llevan más de ${SEGMENT_WINDOWS.activeDays} días sin pasear ni tener uno agendado. Son las que más vale la pena llamar.`,
      ...listed(vipSlipping, familyItem),
      action: toFamilies,
    })
  }

  const atRisk = activity.filter((entry) => entry.segment === 'en_riesgo' && entry.loyalty !== 'vip')
  if (atRisk.length > 0) {
    add({
      id: 'at-risk',
      category: 'familias',
      priority: 'medium',
      title: `${plural(atRisk.length, 'familia', 'familias')} en riesgo`,
      description: `Su último paseo fue hace ${SEGMENT_WINDOWS.activeDays + 1} a ${SEGMENT_WINDOWS.atRiskDays} días y no tienen otro agendado.`,
      ...listed(atRisk, familyItem),
      action: toFamilies,
    })
  }

  const newWithoutWalk = activity.filter((entry) => entry.segment === 'nueva' && entry.completedCount === 0 && entry.upcomingCount === 0)
  if (newWithoutWalk.length > 0) {
    add({
      id: 'new-no-walk',
      category: 'familias',
      priority: 'medium',
      title: `${plural(newWithoutWalk.length, 'familia nueva', 'familias nuevas')} sin su primer paseo`,
      description: `Se registraron en los últimos ${SEGMENT_WINDOWS.newAccountDays} días y no han reservado. Un mensaje de bienvenida ayuda a dar el primer paso.`,
      ...listed(newWithoutWalk, (entry) => ({
        label: entry.customer.name,
        detail: entry.registeredDate ? `Registro ${formatShortDate(entry.registeredDate)}` : undefined,
      })),
      action: toFamilies,
    })
  }

  const withoutDog = customers.filter((customer) => !dogsPerOwner.get(customer.uid))
  if (withoutDog.length > 0) {
    add({
      id: 'no-dog',
      category: 'familias',
      priority: 'low',
      title: `${plural(withoutDog.length, 'familia', 'familias')} sin perro dado de alta`,
      description: 'Para reservar necesitan registrar a su perro. Pregúntales si necesitan ayuda.',
      ...listed(withoutDog, (customer) => ({ label: customer.name, detail: customer.phone || undefined })),
      action: toFamilies,
    })
  }

  const walksPerFamily = new Map<string, number>()
  for (const session of valued) {
    if (CANCELLED_STATUSES.has(session.status)) continue
    walksPerFamily.set(session.customerId, (walksPerFamily.get(session.customerId) ?? 0) + 1)
  }
  const familiesWithWalks = walksPerFamily.size
  const returning = Array.from(walksPerFamily.values()).filter((count) => count > 1).length
  const retention = familiesWithWalks > 0 ? Math.round((returning / familiesWithWalks) * 100) : 0
  if (familiesWithWalks >= limits.minSample && retention < limits.lowRetentionPercent) {
    add({
      id: 'low-retention',
      category: 'familias',
      priority: 'medium',
      title: 'Pocas familias repiten',
      description: `Solo ${retention}% de las familias con paseos han vuelto a reservar.`,
      ...NO_ITEMS,
      action: toFamilies,
    })
  } else if (familiesWithWalks >= limits.minSample && retention >= limits.goodRetentionPercent) {
    add({
      id: 'good-retention',
      category: 'familias',
      priority: 'low',
      title: 'Buena recurrencia',
      description: `${retention}% de las familias con paseos han vuelto a reservar.`,
      ...NO_ITEMS,
    })
  }

  // ── Demanda y valor ──────────────────────────────────────────────────────
  const valueGrowth = growthPercent(value.cents, previousValue.cents)
  if (valueGrowth !== null && valueGrowth >= limits.growthPercent) {
    add({
      id: 'value-up',
      category: 'demanda',
      priority: 'low',
      title: 'Valor completado en alza',
      description: `Subió ${valueGrowth}% frente al periodo anterior del mismo largo.`,
      ...NO_ITEMS,
    })
  } else if (valueGrowth !== null && valueGrowth <= -limits.growthPercent) {
    add({
      id: 'value-down',
      category: 'demanda',
      priority: 'high',
      title: 'Valor completado a la baja',
      description: `Bajó ${Math.abs(valueGrowth)}% frente al periodo anterior del mismo largo.`,
      ...NO_ITEMS,
      action: { label: 'Crear un cupón', href: '/admin/cupones' },
    })
  }

  const walksGrowth = growthPercent(active.length, previousActive.length)
  if (walksGrowth !== null && active.length + previousActive.length >= limits.minSample) {
    if (walksGrowth >= limits.growthPercent) {
      add({
        id: 'walks-up',
        category: 'demanda',
        priority: 'low',
        title: 'Más paseos que el periodo anterior',
        description: `${active.length} contra ${previousActive.length} (+${walksGrowth}%). Revisa que alcancen los paseadores.`,
        ...NO_ITEMS,
      })
    } else if (walksGrowth <= -limits.growthPercent) {
      add({
        id: 'walks-down',
        category: 'demanda',
        priority: 'medium',
        title: 'Menos paseos que el periodo anterior',
        description: `${active.length} contra ${previousActive.length} (${walksGrowth}%). Las familias en riesgo e inactivas son el primer lugar para buscar.`,
        ...NO_ITEMS,
        action: toFamilies,
      })
    }
  }

  if (inPeriod.length >= limits.minSample && cancelRate > limits.cancelRatePercent) {
    add({
      id: 'cancel-rate',
      category: 'demanda',
      priority: 'medium',
      title: `${cancelRate}% de cancelaciones`,
      description: 'Revisa si se concentran en un plan, horario o zona.',
      ...listed([...cancelledInPeriod].sort((a, b) => b.date.localeCompare(a.date)), sessionItem),
    })
  }

  const cancelByDay = new Map<string, number>()
  for (const session of cancelledInPeriod) cancelByDay.set(weekdayOf(session.date), (cancelByDay.get(weekdayOf(session.date)) ?? 0) + 1)
  const worstDay = top(cancelByDay)
  if (worstDay && cancelledInPeriod.length >= limits.minSample) {
    add({
      id: 'cancel-day',
      category: 'demanda',
      priority: 'low',
      title: `Día con más cancelaciones: ${worstDay[0]}`,
      description: `${worstDay[1]} de ${cancelledInPeriod.length} cancelaciones del periodo.`,
      ...NO_ITEMS,
    })
  }

  const weekdayCounts = new Map<string, number>()
  const hourCounts = new Map<string, number>()
  const planCounts = new Map<string, number>()
  for (const session of active) {
    const weekday = weekdayOf(session.date)
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1)
    const hour = (session.arrivalWindowStart || session.time || '').split(':')[0]
    if (hour) hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
    planCounts.set(session.service, (planCounts.get(session.service) ?? 0) + 1)
  }
  const peakDay = top(weekdayCounts)
  const peakHour = top(hourCounts)
  const topPlan = top(planCounts)
  if (peakDay && active.length >= limits.minSample) {
    add({
      id: 'peak-day',
      category: 'demanda',
      priority: 'low',
      title: `Día más demandado: ${peakDay[0]}`,
      description: `Concentra ${peakDay[1]} de ${active.length} paseos del periodo. Asegura paseadores disponibles ese día.`,
      ...NO_ITEMS,
    })
  }
  if (peakHour && active.length >= limits.minSample) {
    add({
      id: 'peak-hour',
      category: 'demanda',
      priority: 'low',
      title: `Hora pico: ${peakHour[0]}:00`,
      description: `${peakHour[1]} paseos empiezan a esa hora. Úsalo para planear disponibilidad.`,
      ...NO_ITEMS,
    })
  }
  if (topPlan && active.length >= limits.minSample) {
    add({
      id: 'top-plan',
      category: 'demanda',
      priority: 'low',
      title: `Plan más reservado: ${topPlan[0]}`,
      description: `Representa ${Math.round((topPlan[1] / active.length) * 100)}% de los paseos del periodo.`,
      ...NO_ITEMS,
    })
  }

  const leadDays = inPeriod
    .map((session) => (session.createdAt ? daysBetweenDates(timestampToMexicoCityDate(session.createdAt), session.date) : null))
    .filter((days): days is number => days !== null && days >= 0)
  const lead = median(leadDays)
  if (lead !== null && leadDays.length >= limits.minSample) {
    add({
      id: 'lead-time',
      category: 'demanda',
      priority: 'low',
      title: lead === 0
        ? 'Las familias reservan para el mismo día'
        : `Las familias reservan con ${plural(lead, 'día', 'días')} de anticipación`,
      description: `Es la mediana de ${leadDays.length} paseos del periodo. Úsala para saber con cuánto tiempo planear paseadores.`,
      ...NO_ITEMS,
    })
  }

  // Zonas: la sesión guarda la dirección, y la dirección guarda la zona. Sin
  // esa cadena no se inventa nada: el paseo se cuenta aparte como desconocido.
  const zoneRows: ZoneRow[] = []
  if (zonesByAddress) {
    const byZone = new Map<string, ZoneRow>()
    for (const session of inPeriod) {
      const name = (session.addressId ? zonesByAddress[session.addressId] : undefined) ?? ZONE_UNKNOWN
      const row = byZone.get(name) ?? { zone: name, walks: 0, completed: 0, cancelled: 0 }
      row.walks += 1
      if (COMPLETED_STATUSES.has(session.status)) row.completed += 1
      if (CANCELLED_STATUSES.has(session.status)) row.cancelled += 1
      byZone.set(name, row)
    }
    zoneRows.push(...Array.from(byZone.values()).sort((a, b) => b.walks - a.walks))

    const named = zoneRows.filter((row) => row.zone !== ZONE_UNKNOWN && row.zone !== ZONE_UNDEFINED)
    if (named.length >= 2 && active.length >= limits.minSample) {
      add({
        id: 'zone-top',
        category: 'demanda',
        priority: 'low',
        title: `Zona con más paseos: ${named[0].zone}`,
        description: `${named[0].walks} de ${inPeriod.length} paseos del periodo salieron de ahí. Asegura paseadores disponibles en esa zona.`,
        ...NO_ITEMS,
      })
      const worst = [...named].sort((a, b) => b.cancelled - a.cancelled)[0]
      if (worst.cancelled >= limits.minSample) {
        add({
          id: 'zone-cancellations',
          category: 'demanda',
          priority: 'medium',
          title: `Las cancelaciones se concentran en ${worst.zone}`,
          description: `${worst.cancelled} de ${cancelledInPeriod.length} cancelaciones del periodo son de esa zona.`,
          ...NO_ITEMS,
        })
      }
    }

    const withoutZone = zoneRows.find((row) => row.zone === ZONE_UNDEFINED)
    if (withoutZone) {
      add({
        id: 'zone-missing',
        category: 'operacion',
        priority: 'low',
        title: `${plural(withoutZone.walks, 'paseo', 'paseos')} con dirección sin zona`,
        description: 'La dirección de la familia no tiene zona asignada. Ese paseo no cuenta en la demanda por zona y tampoco puede avisar si el paseador se sale de la zona.',
        ...NO_ITEMS,
        action: { label: 'Ver zonas', href: '/admin/zonas' },
      })
    }
  }

  const planTable = new Map<string, PlanRow>()
  for (const session of active) {
    const entry = planTable.get(session.serviceId) ?? { name: session.service, walks: 0, completed: 0, cents: 0 }
    entry.walks += 1
    if (COMPLETED_STATUSES.has(session.status)) {
      entry.completed += 1
      if (session.valueCents !== null) entry.cents += session.valueCents
    }
    planTable.set(session.serviceId, entry)
  }

  const categoryIndex = (category: InsightCategory) => INSIGHT_CATEGORY_ORDER.indexOf(category)
  return {
    metrics: { walks: inPeriod.length, completed: completed.length, value, cancelRate },
    insights: insights.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || categoryIndex(a.category) - categoryIndex(b.category)),
    plans: Array.from(planTable.values()).sort((a, b) => b.walks - a.walks),
    zones: zoneRows,
  }
}
