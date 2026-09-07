import { assertNonEmptyId, FinancialDomainError } from './errors'
import { money, requirePositive, sumMoney, type Money } from './money'
import type { RequestHash } from './idempotency'

export type MovementDirection = 'inflow' | 'outflow'
export type FinancialMovementType =
  | 'payment_received'
  | 'refund_issued'
  | 'expense_posted'
  | 'walker_settlement_paid'
  | 'adjustment'
  | 'reversal'

export interface FinancialMovement {
  readonly movementId: string
  readonly operationId: string
  readonly sequence: number
  readonly type: FinancialMovementType
  readonly direction: MovementDirection
  readonly amount: Money
  readonly effectiveAt: string
  readonly sourceType: string
  readonly sourceId: string
  readonly serviceOrderId?: string
  readonly walkSessionId?: string
  readonly walkerId?: string
  readonly cashClosingId?: string
  readonly reversesMovementId?: string
  readonly reasonCode?: string
  readonly requestHash: RequestHash
  readonly createdAt: string
  readonly createdByUid: string
}

export function createFinancialMovement(input: FinancialMovement): Readonly<FinancialMovement> {
  assertNonEmptyId(input.movementId, 'movementId')
  assertNonEmptyId(input.operationId, 'operationId')
  assertNonEmptyId(input.sourceType, 'sourceType')
  assertNonEmptyId(input.sourceId, 'sourceId')
  assertNonEmptyId(input.createdByUid, 'createdByUid')
  requirePositive(input.amount, 'movement.amount')
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Movement sequence must be a non-negative safe integer')
  }
  if (input.type === 'reversal' && !input.reversesMovementId) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'A reversal must reference the original movement')
  }
  if (input.type !== 'reversal' && input.reversesMovementId) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Only a reversal can reference reversesMovementId')
  }
  if ((input.type === 'adjustment' || input.type === 'reversal') && !input.reasonCode) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Adjustments and reversals require a reason code')
  }
  return Object.freeze({ ...input, amount: money(input.amount.amountCents) })
}

export interface ReversalMovementInput {
  readonly movementId: string
  readonly operationId: string
  readonly sequence: number
  readonly original: FinancialMovement
  readonly reasonCode: string
  readonly requestHash: RequestHash
  readonly createdAt: string
  readonly createdByUid: string
}

export function createReversalMovement(input: ReversalMovementInput): Readonly<FinancialMovement> {
  return createFinancialMovement({
    movementId: input.movementId,
    operationId: input.operationId,
    sequence: input.sequence,
    type: 'reversal',
    direction: input.original.direction === 'inflow' ? 'outflow' : 'inflow',
    amount: input.original.amount,
    effectiveAt: input.createdAt,
    sourceType: 'financialMovement',
    sourceId: input.original.movementId,
    serviceOrderId: input.original.serviceOrderId,
    walkSessionId: input.original.walkSessionId,
    walkerId: input.original.walkerId,
    reversesMovementId: input.original.movementId,
    reasonCode: input.reasonCode,
    requestHash: input.requestHash,
    createdAt: input.createdAt,
    createdByUid: input.createdByUid,
  })
}

export function calculateEstimatedOperationalResult(
  movements: readonly FinancialMovement[],
): Money {
  const inflows = sumMoney(movements.filter((movement) => movement.direction === 'inflow').map((movement) => movement.amount))
  const outflows = sumMoney(movements.filter((movement) => movement.direction === 'outflow').map((movement) => movement.amount))
  return money(inflows.amountCents - outflows.amountCents)
}
