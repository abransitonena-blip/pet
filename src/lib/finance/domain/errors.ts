export type FinancialDomainErrorCode =
  | 'INVALID_IDENTIFIER'
  | 'INVALID_MONEY'
  | 'UNSAFE_INTEGER'
  | 'CURRENCY_MISMATCH'
  | 'INVALID_QUANTITY'
  | 'INVALID_DISCOUNT'
  | 'MINIMUM_TOTAL_VIOLATION'
  | 'INVALID_ALLOCATION'
  | 'ALLOCATION_EXCEEDS_PAYMENT'
  | 'ALLOCATION_TOTAL_MISMATCH'
  | 'INVALID_STATE_TRANSITION'
  | 'INVALID_REFUND'
  | 'REFUND_EXCEEDS_AVAILABLE'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'INVALID_REQUEST_HASH'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'FORBIDDEN_CAPABILITY'
  | 'INVALID_SNAPSHOT'
  | 'INVARIANT_VIOLATION'

export class FinancialDomainError extends Error {
  readonly code: FinancialDomainErrorCode
  readonly details: Readonly<Record<string, string | number | boolean | null>>

  constructor(
    code: FinancialDomainErrorCode,
    message: string,
    details: Record<string, string | number | boolean | null> = {},
  ) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'FinancialDomainError'
    this.code = code
    this.details = Object.freeze({ ...details })
  }
}

export function assertNonEmptyId(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200) {
    throw new FinancialDomainError('INVALID_IDENTIFIER', `${field} must be a non-empty identifier`, { field })
  }
  return value
}
