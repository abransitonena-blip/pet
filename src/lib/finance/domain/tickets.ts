import { assertNonEmptyId, FinancialDomainError } from './errors'
import type { PricingSnapshot } from './pricing'

export interface TicketPartySnapshot {
  readonly customerDisplayName: string
  readonly dogDisplayName: string
  readonly serviceDisplayName: string
  readonly walkerDisplayName: string | null
}

export interface TicketBrandSnapshot {
  readonly brandName: 'PET Ap'
  readonly legalDisplayName: string
  readonly contactDisplay: string | null
}

export interface InternalTicket {
  readonly ticketId: string
  readonly visibleFolio: string
  readonly issueKind: 'original' | 'replacement'
  readonly originalTicketId: string | null
  readonly paymentId: string
  readonly serviceOrderId: string
  readonly walkSessionIds: readonly string[]
  readonly movementIds: readonly string[]
  readonly reportId: string | null
  readonly brand: TicketBrandSnapshot
  readonly party: TicketPartySnapshot
  readonly pricing: PricingSnapshot
  readonly verificationCode: string
  readonly verificationUrl: string
  readonly issuedAt: string
  readonly issuedByUid: string
  readonly printCount: number
  readonly documentKind: 'internal-receipt'
  readonly isCfdi: false
}

export function validateInternalTicket(input: InternalTicket, expectedSiteOrigin: string): InternalTicket {
  assertNonEmptyId(input.ticketId, 'ticketId')
  assertNonEmptyId(input.visibleFolio, 'visibleFolio')
  assertNonEmptyId(input.paymentId, 'paymentId')
  assertNonEmptyId(input.serviceOrderId, 'serviceOrderId')
  assertNonEmptyId(input.verificationCode, 'verificationCode')
  assertNonEmptyId(input.issuedByUid, 'issuedByUid')
  if (!Number.isSafeInteger(input.printCount) || input.printCount < 0) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Ticket printCount must be a non-negative safe integer')
  }
  if (input.issueKind === 'replacement' && !input.originalTicketId) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Replacement ticket must reference the original ticket')
  }
  if (input.issueKind === 'original' && input.originalTicketId) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Original ticket cannot reference another ticket')
  }
  if (new Set(input.walkSessionIds).size !== input.walkSessionIds.length) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Ticket cannot repeat a walk session')
  }
  if (new Set(input.movementIds).size !== input.movementIds.length) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Ticket cannot repeat a financial movement')
  }

  let siteOrigin: string
  let verification: URL
  try {
    siteOrigin = new URL(expectedSiteOrigin).origin
    verification = new URL(input.verificationUrl)
  } catch {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Ticket verification URL is invalid')
  }
  if (verification.origin !== siteOrigin || verification.username || verification.password || verification.hash || verification.search) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Ticket verification URL must use the configured site origin without credentials, query data or fragments')
  }

  return Object.freeze({
    ...input,
    walkSessionIds: Object.freeze([...input.walkSessionIds]),
    movementIds: Object.freeze([...input.movementIds]),
    brand: Object.freeze({ ...input.brand }),
    party: Object.freeze({ ...input.party }),
  })
}

export interface TicketReprintRequest {
  readonly ticketId: string
  readonly requestedAt: string
  readonly requestedByUid: string
  readonly reasonCode: string
  readonly expectedTicketSnapshotHash: string
}

export function validateTicketReprintRequest(input: TicketReprintRequest): Readonly<TicketReprintRequest> {
  assertNonEmptyId(input.ticketId, 'ticketId')
  assertNonEmptyId(input.requestedByUid, 'requestedByUid')
  assertNonEmptyId(input.reasonCode, 'reasonCode')
  assertNonEmptyId(input.expectedTicketSnapshotHash, 'expectedTicketSnapshotHash')
  return Object.freeze({ ...input })
}
