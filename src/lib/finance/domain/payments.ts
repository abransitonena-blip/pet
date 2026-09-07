import { assertNonEmptyId, FinancialDomainError } from './errors'
import { money, requireNonNegative, requirePositive, sumMoney, type Money } from './money'
import type { IdempotencyKey, RequestHash } from './idempotency'

export type PaymentStatus =
  | 'pending'
  | 'proof_uploaded'
  | 'under_review'
  | 'confirmed'
  | 'rejected'
  | 'refunded'

export interface PaymentMethodSnapshot {
  readonly code: string
  readonly kind: 'cash' | 'electronic' | 'other'
  readonly displayName: string
  readonly referenceMasked: string | null
}

export interface Payment {
  readonly paymentId: string
  readonly customerId: string
  readonly serviceOrderId: string
  readonly amount: Money
  readonly method: PaymentMethodSnapshot
  readonly status: PaymentStatus
  readonly idempotencyKey: IdempotencyKey
  readonly requestHash: RequestHash
  readonly createdAt: string
  readonly createdByUid: string
  readonly confirmedAt?: string
  readonly confirmedByUid?: string
}

export function validatePayment(input: Payment): Readonly<Payment> {
  assertNonEmptyId(input.paymentId, 'paymentId')
  assertNonEmptyId(input.customerId, 'customerId')
  assertNonEmptyId(input.serviceOrderId, 'serviceOrderId')
  assertNonEmptyId(input.method.code, 'payment.method.code')
  assertNonEmptyId(input.method.displayName, 'payment.method.displayName')
  assertNonEmptyId(input.createdByUid, 'payment.createdByUid')
  requirePositive(input.amount, 'payment.amount')
  const wasConfirmed = input.status === 'confirmed' || input.status === 'refunded'
  if (wasConfirmed && (!input.confirmedAt || !input.confirmedByUid)) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Confirmed payment requires confirmation actor and timestamp')
  }
  if (!wasConfirmed && (input.confirmedAt || input.confirmedByUid)) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Only a confirmed payment can contain confirmation fields')
  }
  return Object.freeze({ ...input, method: Object.freeze({ ...input.method }), amount: money(input.amount.amountCents) })
}

const PAYMENT_TRANSITIONS = {
  pending: ['proof_uploaded', 'under_review', 'rejected'],
  proof_uploaded: ['under_review', 'rejected'],
  under_review: ['confirmed', 'rejected'],
  confirmed: ['refunded'],
  rejected: [],
  refunded: [],
} as const satisfies Record<PaymentStatus, readonly PaymentStatus[]>

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  const allowed: readonly PaymentStatus[] = PAYMENT_TRANSITIONS[from]
  return allowed.includes(to)
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) {
    throw new FinancialDomainError('INVALID_STATE_TRANSITION', `Invalid payment transition: ${from} -> ${to}`)
  }
}

export type AllocationTargetType = 'serviceOrder' | 'walkSession'

export interface PaymentAllocation {
  readonly allocationId: string
  readonly paymentId: string
  readonly targetType: AllocationTargetType
  readonly targetId: string
  readonly amount: Money
  readonly targetFolioSnapshot: string | null
  readonly createdAt: string
}

export function validatePaymentAllocations(
  payment: Payment,
  allocations: readonly PaymentAllocation[],
  mode: 'partial' | 'exact',
): Money {
  if (allocations.length === 0) {
    throw new FinancialDomainError('INVALID_ALLOCATION', 'At least one allocation is required')
  }
  const ids = new Set<string>()
  const targets = new Set<string>()
  requirePositive(payment.amount, 'payment.amount')
  for (const allocation of allocations) {
    assertNonEmptyId(allocation.allocationId, 'allocationId')
    assertNonEmptyId(allocation.targetId, 'allocation.targetId')
    if (allocation.paymentId !== payment.paymentId) {
      throw new FinancialDomainError('INVALID_ALLOCATION', 'Allocation belongs to another payment')
    }
    if (ids.has(allocation.allocationId)) {
      throw new FinancialDomainError('INVALID_ALLOCATION', 'Duplicate allocation ID')
    }
    ids.add(allocation.allocationId)
    const targetKey = `${allocation.targetType}:${allocation.targetId}`
    if (targets.has(targetKey)) {
      throw new FinancialDomainError('INVALID_ALLOCATION', 'A payment cannot repeat an allocation target')
    }
    targets.add(targetKey)
    requirePositive(allocation.amount, 'allocation.amount')
  }

  const total = sumMoney(allocations.map((allocation) => allocation.amount))
  if (total.amountCents > payment.amount.amountCents) {
    throw new FinancialDomainError('ALLOCATION_EXCEEDS_PAYMENT', 'Allocations exceed payment amount')
  }
  if (mode === 'exact' && total.amountCents !== payment.amount.amountCents) {
    throw new FinancialDomainError('ALLOCATION_TOTAL_MISMATCH', 'Allocations must exactly match payment amount')
  }
  return total
}

export type RefundStatus = 'requested' | 'under_review' | 'confirmed' | 'rejected' | 'cancelled'

const REFUND_TRANSITIONS = {
  requested: ['under_review', 'cancelled'],
  under_review: ['confirmed', 'rejected', 'cancelled'],
  confirmed: [],
  rejected: [],
  cancelled: [],
} as const satisfies Record<RefundStatus, readonly RefundStatus[]>

export function assertRefundTransition(from: RefundStatus, to: RefundStatus): void {
  const allowed: readonly RefundStatus[] = REFUND_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new FinancialDomainError('INVALID_STATE_TRANSITION', `Invalid refund transition: ${from} -> ${to}`)
  }
}

export interface Refund {
  readonly refundId: string
  readonly paymentId: string
  readonly amount: Money
  readonly reasonCode: string
  readonly status: RefundStatus
  readonly idempotencyKey: IdempotencyKey
  readonly requestHash: RequestHash
  readonly createdAt: string
  readonly createdByUid: string
}

export function refundableAmount(payment: Payment, confirmedRefunds: readonly Refund[]): Money {
  if (payment.status !== 'confirmed' && payment.status !== 'refunded') return money(0)
  const refunded = sumMoney(
    confirmedRefunds
      .filter((refund) => refund.paymentId === payment.paymentId && refund.status === 'confirmed')
      .map((refund) => refund.amount),
  )
  if (refunded.amountCents > payment.amount.amountCents) {
    throw new FinancialDomainError('INVARIANT_VIOLATION', 'Confirmed refunds exceed payment amount')
  }
  return money(payment.amount.amountCents - refunded.amountCents)
}

export function validateRefundDraft(
  payment: Payment,
  refund: Refund,
  existingRefunds: readonly Refund[],
): Refund {
  assertNonEmptyId(refund.refundId, 'refundId')
  assertNonEmptyId(refund.reasonCode, 'refund.reasonCode')
  if (refund.paymentId !== payment.paymentId || refund.status !== 'requested') {
    throw new FinancialDomainError('INVALID_REFUND', 'Refund draft must target the payment and begin as requested')
  }
  requirePositive(refund.amount, 'refund.amount')
  const available = refundableAmount(payment, existingRefunds)
  if (refund.amount.amountCents > available.amountCents) {
    throw new FinancialDomainError('REFUND_EXCEEDS_AVAILABLE', 'Refund exceeds the remaining refundable amount')
  }
  requireNonNegative(available, 'refundableAmount')
  return Object.freeze({ ...refund, amount: money(refund.amount.amountCents) })
}
