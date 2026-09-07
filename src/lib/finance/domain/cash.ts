import { assertNonEmptyId, FinancialDomainError } from './errors'
import { money, requireNonNegative, requirePositive, sumMoney, type Money } from './money'
import type { IdempotencyKey, RequestHash } from './idempotency'

export type CashClosingStatus = 'draft' | 'closing' | 'closed' | 'cancelled'

const CASH_CLOSING_TRANSITIONS = {
  draft: ['closing', 'cancelled'],
  closing: ['draft', 'closed'],
  closed: [],
  cancelled: [],
} as const satisfies Record<CashClosingStatus, readonly CashClosingStatus[]>

export function assertCashClosingTransition(from: CashClosingStatus, to: CashClosingStatus): void {
  const allowed: readonly CashClosingStatus[] = CASH_CLOSING_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new FinancialDomainError('INVALID_STATE_TRANSITION', `Invalid cash closing transition: ${from} -> ${to}`)
  }
}

export interface CashMethodTotalSnapshot {
  readonly methodCode: string
  readonly expectedAmount: Money
  readonly declaredAmount: Money
  readonly movementCount: number
}

export interface CashClosing {
  readonly cashClosingId: string
  readonly visibleFolio: string | null
  readonly registerId: string
  readonly cashierUid: string
  readonly windowStart: string
  readonly windowEnd: string
  readonly status: CashClosingStatus
  readonly methodTotals: readonly CashMethodTotalSnapshot[]
  readonly expectedTotal: Money
  readonly declaredTotal: Money
  readonly difference: Money
  readonly movementIds: readonly string[]
  readonly reasonCode: string | null
  readonly idempotencyKey: IdempotencyKey
  readonly requestHash: RequestHash
  readonly createdAt: string
}

export function buildCashClosing(input: Omit<CashClosing, 'expectedTotal' | 'declaredTotal' | 'difference'>): CashClosing {
  assertNonEmptyId(input.cashClosingId, 'cashClosingId')
  assertNonEmptyId(input.registerId, 'registerId')
  assertNonEmptyId(input.cashierUid, 'cashierUid')
  if (input.methodTotals.length === 0) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Cash closing requires method totals')
  }
  const methodCodes = new Set<string>()
  for (const method of input.methodTotals) {
    assertNonEmptyId(method.methodCode, 'methodCode')
    requireNonNegative(method.expectedAmount, 'expectedAmount')
    requireNonNegative(method.declaredAmount, 'declaredAmount')
    if (!Number.isSafeInteger(method.movementCount) || method.movementCount < 0) {
      throw new FinancialDomainError('INVALID_SNAPSHOT', 'movementCount must be a non-negative safe integer')
    }
    if (methodCodes.has(method.methodCode)) {
      throw new FinancialDomainError('INVALID_SNAPSHOT', 'Cash closing method codes must be unique')
    }
    methodCodes.add(method.methodCode)
  }
  if (new Set(input.movementIds).size !== input.movementIds.length) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Cash closing cannot include a movement twice')
  }
  const expectedTotal = sumMoney(input.methodTotals.map((method) => method.expectedAmount))
  const declaredTotal = sumMoney(input.methodTotals.map((method) => method.declaredAmount))
  const difference = money(declaredTotal.amountCents - expectedTotal.amountCents)

  return Object.freeze({
    ...input,
    methodTotals: Object.freeze(input.methodTotals.map((method) => Object.freeze({
      ...method,
      expectedAmount: money(method.expectedAmount.amountCents),
      declaredAmount: money(method.declaredAmount.amountCents),
    }))),
    movementIds: Object.freeze([...input.movementIds]),
    expectedTotal,
    declaredTotal,
    difference,
  })
}

export type WalkerSettlementStatus = 'draft' | 'reviewed' | 'approved' | 'paid' | 'rejected' | 'cancelled'

const SETTLEMENT_TRANSITIONS = {
  draft: ['reviewed', 'cancelled'],
  reviewed: ['approved', 'rejected', 'draft'],
  approved: ['paid', 'cancelled'],
  paid: [],
  rejected: [],
  cancelled: [],
} as const satisfies Record<WalkerSettlementStatus, readonly WalkerSettlementStatus[]>

export function assertWalkerSettlementTransition(from: WalkerSettlementStatus, to: WalkerSettlementStatus): void {
  const allowed: readonly WalkerSettlementStatus[] = SETTLEMENT_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new FinancialDomainError('INVALID_STATE_TRANSITION', `Invalid walker settlement transition: ${from} -> ${to}`)
  }
}

export interface WalkerSettlementLineSnapshot {
  readonly walkSessionId: string
  readonly serviceOrderId: string
  readonly completedAt: string
  readonly amount: Money
  readonly calculationVersion: string
}

export interface WalkerSettlement {
  readonly settlementId: string
  readonly visibleFolio: string | null
  readonly walkerId: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly status: WalkerSettlementStatus
  readonly lines: readonly WalkerSettlementLineSnapshot[]
  readonly adjustments: readonly { readonly reasonCode: string; readonly amount: Money }[]
  readonly total: Money
  readonly idempotencyKey: IdempotencyKey
  readonly requestHash: RequestHash
  readonly createdAt: string
  readonly createdByUid: string
}

export function buildWalkerSettlement(input: Omit<WalkerSettlement, 'total'>): WalkerSettlement {
  assertNonEmptyId(input.settlementId, 'settlementId')
  assertNonEmptyId(input.walkerId, 'walkerId')
  if (input.lines.length === 0) throw new FinancialDomainError('INVALID_SNAPSHOT', 'Settlement requires at least one session')
  const sessionIds = new Set<string>()
  for (const line of input.lines) {
    assertNonEmptyId(line.walkSessionId, 'walkSessionId')
    assertNonEmptyId(line.serviceOrderId, 'serviceOrderId')
    assertNonEmptyId(line.calculationVersion, 'calculationVersion')
    requireNonNegative(line.amount, 'settlement.line.amount')
    if (sessionIds.has(line.walkSessionId)) {
      throw new FinancialDomainError('INVALID_SNAPSHOT', 'A session cannot appear twice in one settlement')
    }
    sessionIds.add(line.walkSessionId)
  }
  for (const adjustment of input.adjustments) {
    assertNonEmptyId(adjustment.reasonCode, 'adjustment.reasonCode')
  }
  const total = sumMoney([
    ...input.lines.map((line) => line.amount),
    ...input.adjustments.map((adjustment) => adjustment.amount),
  ])
  requireNonNegative(total, 'settlement.total')
  return Object.freeze({
    ...input,
    lines: Object.freeze(input.lines.map((line) => Object.freeze({ ...line, amount: money(line.amount.amountCents) }))),
    adjustments: Object.freeze(input.adjustments.map((adjustment) => Object.freeze({ ...adjustment, amount: money(adjustment.amount.amountCents) }))),
    total,
  })
}

export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'posted' | 'rejected' | 'reversed'

const EXPENSE_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected', 'draft'],
  approved: ['posted', 'rejected'],
  posted: ['reversed'],
  rejected: [],
  reversed: [],
} as const satisfies Record<ExpenseStatus, readonly ExpenseStatus[]>

export function assertExpenseTransition(from: ExpenseStatus, to: ExpenseStatus): void {
  const allowed: readonly ExpenseStatus[] = EXPENSE_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new FinancialDomainError('INVALID_STATE_TRANSITION', `Invalid expense transition: ${from} -> ${to}`)
  }
}

export interface Expense {
  readonly expenseId: string
  readonly categoryCode: string
  readonly descriptionSnapshot: string
  readonly amount: Money
  readonly expenseDate: string
  readonly status: ExpenseStatus
  readonly evidenceReference: string | null
  readonly idempotencyKey: IdempotencyKey
  readonly requestHash: RequestHash
  readonly createdAt: string
  readonly createdByUid: string
}

export function validateExpense(input: Expense): Readonly<Expense> {
  assertNonEmptyId(input.expenseId, 'expenseId')
  assertNonEmptyId(input.categoryCode, 'categoryCode')
  requirePositive(input.amount, 'expense.amount')
  return Object.freeze({ ...input, amount: money(input.amount.amountCents) })
}
