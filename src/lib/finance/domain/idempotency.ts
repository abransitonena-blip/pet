import { FinancialDomainError } from './errors'

declare const idempotencyKeyBrand: unique symbol
declare const requestHashBrand: unique symbol

export type IdempotencyKey = string & { readonly [idempotencyKeyBrand]: true }
export type RequestHash = string & { readonly [requestHashBrand]: true }

export function parseIdempotencyKey(value: string): IdempotencyKey {
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(value)) {
    throw new FinancialDomainError(
      'INVALID_IDEMPOTENCY_KEY',
      'Idempotency key must contain 16-128 safe characters',
    )
  }
  return value as IdempotencyKey
}

export function parseRequestHash(value: string): RequestHash {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new FinancialDomainError('INVALID_REQUEST_HASH', 'Request hash must be a 64-character hexadecimal digest')
  }
  return value.toLowerCase() as RequestHash
}

export type IdempotencyReceiptStatus = 'processing' | 'succeeded' | 'rejected' | 'failed_safe'

export interface IdempotencyReceipt<TResult> {
  readonly operationId: string
  readonly keyHash: RequestHash
  readonly requestHash: RequestHash
  readonly status: IdempotencyReceiptStatus
  readonly result?: Readonly<TResult>
  readonly createdAt: string
  readonly completedAt?: string
}

export type IdempotencyDecision<TResult> =
  | { readonly kind: 'new' }
  | { readonly kind: 'replay'; readonly result: Readonly<TResult> }
  | { readonly kind: 'rejected'; readonly result?: Readonly<TResult> }

export function evaluateIdempotency<TResult>(
  existing: IdempotencyReceipt<TResult> | null,
  incomingRequestHash: RequestHash,
): IdempotencyDecision<TResult> {
  if (!existing) return { kind: 'new' }
  if (existing.requestHash !== incomingRequestHash) {
    throw new FinancialDomainError('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with a different request')
  }
  if (existing.status === 'processing') {
    throw new FinancialDomainError('IDEMPOTENCY_IN_PROGRESS', 'The original operation is still processing')
  }
  if (existing.status === 'succeeded') {
    if (existing.result === undefined) {
      throw new FinancialDomainError('INVARIANT_VIOLATION', 'Successful idempotency receipt has no result')
    }
    return { kind: 'replay', result: existing.result }
  }
  return { kind: 'rejected', result: existing.result }
}

