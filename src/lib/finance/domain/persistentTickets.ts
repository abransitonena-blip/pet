import { assertNonEmptyId, FinancialDomainError } from './errors'

export const PERSISTENT_TICKET_SCHEMA_VERSION = 1 as const

export type PersistentTicketPaymentStatus = 'not_recorded'
export type PersistentTicketStatus = 'active'
export type PersistentPrintMode = 'original' | 'reprint'
export type PersistentPrintTransport = 'manual_hex' | 'mock'
export type PersistentPrintStatus = 'payload_exported' | 'operator_confirmed' | 'failed'

export interface PersistentTicketSnapshot {
  readonly schemaVersion: typeof PERSISTENT_TICKET_SCHEMA_VERSION
  readonly documentType: 'internal-receipt'
  readonly isCfdi: false
  readonly currency: 'MXN'
  readonly folio: string
  readonly serviceFolio: string
  readonly walkSessionId: string
  readonly walkReportId: string
  readonly customerId: string
  readonly walkerId: string
  readonly dogIds: readonly string[]
  readonly customerName: string
  readonly dogNames: Readonly<Record<string, string>>
  readonly walkerName: string
  readonly serviceId: string
  readonly serviceName: string
  readonly durationMinutes: number | null
  readonly serviceDate: string
  readonly startTime: string
  readonly endTime: string | null
  readonly reportUrl: string
  readonly verificationCode: string
  readonly paymentStatus: PersistentTicketPaymentStatus
  readonly subtotalCents: null
  readonly discountCents: null
  readonly tipCents: null
  readonly totalCents: null
  readonly amountPaidCents: null
  readonly balanceDueCents: null
  readonly paymentMethod: null
  readonly createdAt: unknown
  readonly createdBy: string
  readonly status: PersistentTicketStatus
}

export interface PersistentPrintEvent {
  readonly ticketId: string
  readonly actorUid: string
  readonly mode: PersistentPrintMode
  readonly transport: PersistentPrintTransport
  readonly status: PersistentPrintStatus
  readonly payloadHash: string
  readonly byteLength: number
  readonly createdAt: unknown
  readonly errorCode?: string
}

export interface BuildPersistentTicketInput {
  readonly walkSessionId: string
  readonly walkReportId: string
  readonly customerId: string
  readonly walkerId: string
  readonly dogIds: readonly string[]
  readonly customerName: string
  readonly dogNames: Readonly<Record<string, string>>
  readonly walkerName: string
  readonly serviceId: string
  readonly serviceName: string
  readonly durationMinutes: number | null
  readonly serviceDate: string
  readonly startTime: string
  readonly endTime: string | null
  readonly siteOrigin: string
  readonly createdBy: string
  readonly createdAt: unknown
}

function displayName(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 120) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', `${field} must contain 1 to 120 characters`)
  }
  return normalized
}

function safeOrigin(value: string): string {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('invalid-origin')
    return parsed.origin
  } catch {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'siteOrigin must be a credential-free HTTPS origin')
  }
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function ticketIdForSession(walkSessionId: string): string {
  assertNonEmptyId(walkSessionId, 'walkSessionId')
  if (walkSessionId.includes('/')) throw new FinancialDomainError('INVALID_SNAPSHOT', 'walkSessionId cannot contain a path separator')
  return walkSessionId
}

export function ticketFolioForSession(walkSessionId: string): string {
  return `TKT-${ticketIdForSession(walkSessionId)}`
}

export function serviceFolioForSession(walkSessionId: string): string {
  return `PET-${ticketIdForSession(walkSessionId)}`
}

export function verificationCodeForTicket(walkSessionId: string, walkReportId: string): string {
  const fingerprint = fnv1a(`${ticketIdForSession(walkSessionId)}:${ticketIdForSession(walkReportId)}`)
  return Number.parseInt(fingerprint, 16).toString(36).toUpperCase().padStart(6, '0').slice(-6)
}

export function buildPersistentTicketSnapshot(input: BuildPersistentTicketInput): Readonly<PersistentTicketSnapshot> {
  const walkSessionId = ticketIdForSession(input.walkSessionId)
  const walkReportId = ticketIdForSession(input.walkReportId)
  if (walkSessionId !== walkReportId) throw new FinancialDomainError('INVALID_SNAPSHOT', 'walkReportId must match walkSessionId')
  assertNonEmptyId(input.customerId, 'customerId')
  assertNonEmptyId(input.walkerId, 'walkerId')
  assertNonEmptyId(input.createdBy, 'createdBy')
  assertNonEmptyId(input.serviceId, 'serviceId')
  assertNonEmptyId(input.serviceDate, 'serviceDate')
  assertNonEmptyId(input.startTime, 'startTime')
  if (input.endTime !== null) assertNonEmptyId(input.endTime, 'endTime')
  if (input.durationMinutes !== null && (!Number.isSafeInteger(input.durationMinutes) || input.durationMinutes <= 0)) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'durationMinutes must be null or a positive safe integer')
  }
  if (input.dogIds.length === 0 || input.dogIds.length > 4 || new Set(input.dogIds).size !== input.dogIds.length) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'dogIds must contain between one and four unique IDs')
  }
  const dogNames = Object.fromEntries(input.dogIds.map((dogId) => {
    assertNonEmptyId(dogId, 'dogId')
    return [dogId, displayName(input.dogNames[dogId] ?? '', `dogNames.${dogId}`)]
  }))
  const reportUrl = new URL(`/familia/reportes/${encodeURIComponent(walkReportId)}`, `${safeOrigin(input.siteOrigin)}/`).toString()
  return Object.freeze({
    schemaVersion: PERSISTENT_TICKET_SCHEMA_VERSION,
    documentType: 'internal-receipt',
    isCfdi: false,
    currency: 'MXN',
    folio: ticketFolioForSession(walkSessionId),
    serviceFolio: serviceFolioForSession(walkSessionId),
    walkSessionId,
    walkReportId,
    customerId: input.customerId,
    walkerId: input.walkerId,
    dogIds: Object.freeze([...input.dogIds]),
    customerName: displayName(input.customerName, 'customerName'),
    dogNames: Object.freeze(dogNames),
    walkerName: displayName(input.walkerName, 'walkerName'),
    serviceId: input.serviceId,
    serviceName: displayName(input.serviceName, 'serviceName'),
    durationMinutes: input.durationMinutes,
    serviceDate: input.serviceDate,
    startTime: input.startTime,
    endTime: input.endTime,
    reportUrl,
    verificationCode: verificationCodeForTicket(walkSessionId, walkReportId),
    paymentStatus: 'not_recorded',
    subtotalCents: null,
    discountCents: null,
    tipCents: null,
    totalCents: null,
    amountPaidCents: null,
    balanceDueCents: null,
    paymentMethod: null,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    status: 'active',
  })
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]))
  }
  return value
}

export function persistentTicketFingerprint(ticket: PersistentTicketSnapshot): string {
  const { createdAt: _createdAt, ...comparable } = ticket
  return JSON.stringify(stableValue(comparable))
}

