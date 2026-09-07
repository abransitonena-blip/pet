import { assertNonEmptyId, FinancialDomainError } from './errors'
import { assertMoney, money, requireNonNegative, type Money } from './money'

export type TemporaryTicketMode = 'original' | 'reprint'
export type TemporaryReportStatus = 'missing' | 'draft' | 'submitted'
export type TemporaryPaymentStatus = 'not_registered' | 'pending' | 'partial' | 'paid' | 'courtesy'

export interface TemporaryTicketIdentitySnapshot {
  readonly uid: string
  readonly displayName: string
}

export type TemporaryTicketDogSnapshot = TemporaryTicketIdentitySnapshot

export interface TemporaryTicketFinancialSnapshot {
  readonly reliable: boolean
  readonly subtotal: Money | null
  readonly discount: Money | null
  readonly tip: Money | null
  readonly total: Money | null
  readonly amountPaid: Money | null
  readonly balanceDue: Money | null
  readonly paymentMethod: string | null
  readonly paymentStatus: TemporaryPaymentStatus
  readonly complimentary: boolean
}

export interface TemporaryTicketSnapshot {
  readonly documentType: 'internal-receipt'
  readonly isCfdi: false
  readonly isPersistent: false
  readonly currency: 'MXN'
  readonly ticketId: string
  readonly folio: string
  readonly walkSessionId: string
  readonly walkReportId: string
  readonly customer: TemporaryTicketIdentitySnapshot
  readonly dogs: readonly TemporaryTicketDogSnapshot[]
  readonly walker: TemporaryTicketIdentitySnapshot
  readonly serviceId: string
  readonly serviceDisplayName: string
  readonly durationMinutes: number | null
  readonly serviceDate: string
  readonly startTime: string
  readonly endTime: string | null
  readonly walkStatus: 'completed'
  readonly reportStatus: TemporaryReportStatus
  readonly financial: TemporaryTicketFinancialSnapshot
  readonly reportUrl: string | null
  readonly verificationCode: string
  readonly mode: TemporaryTicketMode
  readonly generatedAt: string
}

export interface BuildTemporaryTicketSnapshotInput {
  readonly walkSessionId: string
  readonly walkReportId: string
  readonly customer: TemporaryTicketIdentitySnapshot
  readonly dogs: readonly TemporaryTicketDogSnapshot[]
  readonly walker: TemporaryTicketIdentitySnapshot
  readonly serviceId: string
  readonly serviceDisplayName: string
  readonly durationMinutes: number | null
  readonly serviceDate: string
  readonly startTime: string
  readonly endTime: string | null
  readonly walkStatus: 'completed'
  readonly reportStatus: TemporaryReportStatus
  readonly financial?: TemporaryTicketFinancialSnapshot | null
  readonly siteOrigin: string
  readonly mode: TemporaryTicketMode
  readonly generatedAt: string
}

function assertDisplayName(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 120) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', `${field} must be a non-empty display name with at most 120 characters`)
  }
  return normalized
}

function assertIsoDate(value: string): string {
  const parsed = new Date(value)
  if (!value || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'generatedAt must be an ISO timestamp')
  }
  return value
}

function cloneIdentity(value: TemporaryTicketIdentitySnapshot, field: string): TemporaryTicketIdentitySnapshot {
  assertNonEmptyId(value.uid, `${field}.uid`)
  return Object.freeze({ uid: value.uid, displayName: assertDisplayName(value.displayName, `${field}.displayName`) })
}

function cloneNullableMoney(value: Money | null, field: string): Money | null {
  if (value === null) return null
  assertMoney(value, field)
  requireNonNegative(value, field)
  return money(value.amountCents)
}

function unknownFinancialSnapshot(): TemporaryTicketFinancialSnapshot {
  return Object.freeze({
    reliable: false,
    subtotal: null,
    discount: null,
    tip: null,
    total: null,
    amountPaid: null,
    balanceDue: null,
    paymentMethod: null,
    paymentStatus: 'not_registered',
    complimentary: false,
  })
}

function cloneFinancialSnapshot(value?: TemporaryTicketFinancialSnapshot | null): TemporaryTicketFinancialSnapshot {
  if (!value || !value.reliable) {
    if (value && (
      value.subtotal !== null || value.discount !== null || value.tip !== null || value.total !== null
      || value.amountPaid !== null || value.balanceDue !== null || value.paymentMethod !== null
      || value.paymentStatus !== 'not_registered' || value.complimentary
    )) {
      throw new FinancialDomainError('INVALID_SNAPSHOT', 'Unreliable financial snapshots cannot contain amounts or payment assertions')
    }
    return unknownFinancialSnapshot()
  }

  const subtotal = cloneNullableMoney(value.subtotal, 'financial.subtotal')
  const discount = cloneNullableMoney(value.discount, 'financial.discount')
  const tip = cloneNullableMoney(value.tip, 'financial.tip')
  const total = cloneNullableMoney(value.total, 'financial.total')
  const amountPaid = cloneNullableMoney(value.amountPaid, 'financial.amountPaid')
  const balanceDue = cloneNullableMoney(value.balanceDue, 'financial.balanceDue')
  if (subtotal === null || total === null) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Reliable financial snapshots require subtotal and total')
  }
  if (value.complimentary && (total.amountCents !== 0 || value.paymentStatus !== 'courtesy')) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Complimentary previews require a zero total and courtesy payment status')
  }
  if (!value.complimentary && value.paymentStatus === 'courtesy') {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Courtesy payment status requires an explicit complimentary snapshot')
  }
  const paymentMethod = value.paymentMethod?.trim() || null
  return Object.freeze({
    reliable: true,
    subtotal,
    discount,
    tip,
    total,
    amountPaid,
    balanceDue,
    paymentMethod,
    paymentStatus: value.paymentStatus,
    complimentary: value.complimentary,
  })
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function reportUrlFor(input: BuildTemporaryTicketSnapshotInput): string | null {
  if (input.reportStatus !== 'submitted') return null
  let origin: string
  try {
    const parsed = new URL(input.siteOrigin)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('invalid-origin')
    origin = parsed.origin
  } catch {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'siteOrigin must be a credential-free HTTPS origin')
  }
  return new URL(`/familia/reportes/${encodeURIComponent(input.walkReportId)}`, `${origin}/`).toString()
}

export function buildTemporaryTicketSnapshot(input: BuildTemporaryTicketSnapshotInput): TemporaryTicketSnapshot {
  assertNonEmptyId(input.walkSessionId, 'walkSessionId')
  assertNonEmptyId(input.walkReportId, 'walkReportId')
  assertNonEmptyId(input.serviceId, 'serviceId')
  if (input.walkSessionId !== input.walkReportId) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Temporary report ID must match its walk session ID')
  }
  if (input.walkStatus !== 'completed') {
    throw new FinancialDomainError('INVALID_STATE_TRANSITION', 'Only completed walk sessions can produce a ticket preview')
  }
  if (input.dogs.length === 0 || new Set(input.dogs.map((dog) => dog.uid)).size !== input.dogs.length) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Ticket preview requires one or more unique dogs')
  }
  if (input.durationMinutes !== null && (!Number.isSafeInteger(input.durationMinutes) || input.durationMinutes <= 0)) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'durationMinutes must be null or a positive safe integer')
  }
  assertNonEmptyId(input.serviceDate, 'serviceDate')
  assertNonEmptyId(input.startTime, 'startTime')
  if (input.endTime !== null) assertNonEmptyId(input.endTime, 'endTime')
  const generatedAt = assertIsoDate(input.generatedAt)
  const customer = cloneIdentity(input.customer, 'customer')
  const walker = cloneIdentity(input.walker, 'walker')
  const dogs = Object.freeze(input.dogs.map((dog, index) => cloneIdentity(dog, `dogs[${index}]`)))
  const financial = cloneFinancialSnapshot(input.financial)
  const reportUrl = reportUrlFor(input)
  const fingerprint = fnv1a(JSON.stringify({
    walkSessionId: input.walkSessionId,
    walkReportId: input.walkReportId,
    customer,
    dogs,
    walker,
    serviceId: input.serviceId,
    serviceDisplayName: input.serviceDisplayName,
    durationMinutes: input.durationMinutes,
    serviceDate: input.serviceDate,
    startTime: input.startTime,
    endTime: input.endTime,
    reportStatus: input.reportStatus,
    financial,
    mode: input.mode,
    generatedAt,
  }))
  const verificationCode = Number.parseInt(fingerprint, 16).toString(36).toUpperCase().padStart(4, '0').slice(-4)

  return Object.freeze({
    documentType: 'internal-receipt',
    isCfdi: false,
    isPersistent: false,
    currency: 'MXN',
    ticketId: `demo-ticket-${fingerprint}`,
    folio: `DEMO-PET-${fingerprint.toUpperCase()}`,
    walkSessionId: input.walkSessionId,
    walkReportId: input.walkReportId,
    customer,
    dogs,
    walker,
    serviceId: input.serviceId,
    serviceDisplayName: assertDisplayName(input.serviceDisplayName, 'serviceDisplayName'),
    durationMinutes: input.durationMinutes,
    serviceDate: input.serviceDate,
    startTime: input.startTime,
    endTime: input.endTime,
    walkStatus: 'completed',
    reportStatus: input.reportStatus,
    financial,
    reportUrl,
    verificationCode,
    mode: input.mode,
    generatedAt,
  })
}
