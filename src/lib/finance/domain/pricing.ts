import { assertNonEmptyId, FinancialDomainError } from './errors'
import {
  addMoney,
  money,
  multiplyMoney,
  requireNonNegative,
  requirePositive,
  subtractMoney,
  sumMoney,
  type Money,
} from './money'

export interface PriceLineSnapshot {
  readonly lineId: string
  readonly serviceId: string
  readonly description: string
  readonly quantity: number
  readonly unitAmount: Money
  readonly lineTotal: Money
}

export type DiscountKind = 'coupon' | 'referral' | 'promotional_credit' | 'courtesy' | 'manual'

export interface DiscountSnapshot {
  readonly discountId: string
  readonly kind: DiscountKind
  readonly description: string
  readonly amount: Money
  readonly policyVersion: string
  readonly approvedByUid: string
}

export type ChargeKind = 'tax' | 'cancellation' | 'service_fee' | 'other'

export interface ChargeSnapshot {
  readonly chargeId: string
  readonly kind: ChargeKind
  readonly description: string
  readonly amount: Money
  readonly policyVersion: string
}

export interface TipSnapshot {
  readonly amount: Money
  readonly declaredByUid: string
  readonly declaredAt: string
  readonly treatment: 'pending_professional_definition'
}

export interface PricingSnapshot {
  readonly schemaVersion: number
  readonly priceVersion: string
  readonly capturedAt: string
  readonly lines: readonly PriceLineSnapshot[]
  readonly discounts: readonly DiscountSnapshot[]
  readonly charges: readonly ChargeSnapshot[]
  readonly tip: TipSnapshot | null
  readonly subtotal: Money
  readonly discountTotal: Money
  readonly chargeTotal: Money
  readonly serviceTotal: Money
  readonly grandTotal: Money
  readonly minimumServiceTotal: Money
  readonly currency: 'MXN'
}

export interface BuildPricingSnapshotInput {
  readonly schemaVersion: number
  readonly priceVersion: string
  readonly capturedAt: string
  readonly lines: readonly Omit<PriceLineSnapshot, 'lineTotal'>[]
  readonly discounts?: readonly DiscountSnapshot[]
  readonly charges?: readonly ChargeSnapshot[]
  readonly tip?: TipSnapshot | null
  readonly minimumServiceTotal: Money
}

function freezeItems<T extends object>(values: readonly T[]): readonly Readonly<T>[] {
  return Object.freeze(values.map((value) => Object.freeze({ ...value })))
}

export function buildPricingSnapshot(input: BuildPricingSnapshotInput): PricingSnapshot {
  if (!Number.isSafeInteger(input.schemaVersion) || input.schemaVersion <= 0) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'schemaVersion must be a positive safe integer')
  }
  assertNonEmptyId(input.priceVersion, 'priceVersion')
  if (input.lines.length === 0) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'A pricing snapshot requires at least one line')
  }

  const lineIds = new Set<string>()
  const lines = input.lines.map((line): PriceLineSnapshot => {
    assertNonEmptyId(line.lineId, 'lineId')
    assertNonEmptyId(line.serviceId, 'serviceId')
    if (lineIds.has(line.lineId)) throw new FinancialDomainError('INVALID_SNAPSHOT', 'Duplicate pricing line ID')
    lineIds.add(line.lineId)
    requireNonNegative(line.unitAmount, 'unitAmount')
    const unitAmount = money(line.unitAmount.amountCents)
    const lineTotal = multiplyMoney(unitAmount, line.quantity)
    return Object.freeze({ ...line, unitAmount, lineTotal })
  })

  const discounts = input.discounts ?? []
  const charges = input.charges ?? []
  const discountIds = new Set<string>()
  for (const discount of discounts) {
    assertNonEmptyId(discount.discountId, 'discountId')
    if (discountIds.has(discount.discountId)) throw new FinancialDomainError('INVALID_DISCOUNT', 'Duplicate discount ID')
    discountIds.add(discount.discountId)
    assertNonEmptyId(discount.policyVersion, 'discount.policyVersion')
    assertNonEmptyId(discount.approvedByUid, 'discount.approvedByUid')
    requireNonNegative(discount.amount, 'discount.amount')
  }
  const chargeIds = new Set<string>()
  for (const charge of charges) {
    assertNonEmptyId(charge.chargeId, 'chargeId')
    if (chargeIds.has(charge.chargeId)) throw new FinancialDomainError('INVALID_SNAPSHOT', 'Duplicate charge ID')
    chargeIds.add(charge.chargeId)
    assertNonEmptyId(charge.policyVersion, 'charge.policyVersion')
    requireNonNegative(charge.amount, 'charge.amount')
  }
  if (input.tip) {
    requireNonNegative(input.tip.amount, 'tip.amount')
    assertNonEmptyId(input.tip.declaredByUid, 'tip.declaredByUid')
  }
  requireNonNegative(input.minimumServiceTotal, 'minimumServiceTotal')

  const subtotal = sumMoney(lines.map((line) => line.lineTotal))
  const discountTotal = sumMoney(discounts.map((discount) => discount.amount))
  if (discountTotal.amountCents > subtotal.amountCents) {
    throw new FinancialDomainError('INVALID_DISCOUNT', 'Discounts cannot exceed the service subtotal')
  }
  const chargeTotal = sumMoney(charges.map((charge) => charge.amount))
  const serviceTotal = addMoney(subtractMoney(subtotal, discountTotal), chargeTotal)
  if (serviceTotal.amountCents < input.minimumServiceTotal.amountCents) {
    throw new FinancialDomainError('MINIMUM_TOTAL_VIOLATION', 'Pricing result is below the approved minimum service total')
  }
  const grandTotal = addMoney(serviceTotal, input.tip?.amount ?? money(0))

  return Object.freeze({
    schemaVersion: input.schemaVersion,
    priceVersion: input.priceVersion,
    capturedAt: input.capturedAt,
    lines: Object.freeze(lines),
    discounts: freezeItems(discounts.map((discount) => ({ ...discount, amount: money(discount.amount.amountCents) }))),
    charges: freezeItems(charges.map((charge) => ({ ...charge, amount: money(charge.amount.amountCents) }))),
    tip: input.tip ? Object.freeze({ ...input.tip, amount: money(input.tip.amount.amountCents) }) : null,
    subtotal,
    discountTotal,
    chargeTotal,
    serviceTotal,
    grandTotal,
    minimumServiceTotal: money(input.minimumServiceTotal.amountCents),
    currency: 'MXN',
  })
}

export interface CancellationDecisionSnapshot {
  readonly policyVersion: string
  readonly decision: 'no_charge' | 'charge' | 'manual_review'
  readonly reasonCode: string
  readonly decidedAt: string
  readonly decidedByUid: string
  readonly paidAmount: Money
  readonly retainedAmount: Money
  readonly refundableAmount: Money
}

export function buildCancellationDecision(
  input: CancellationDecisionSnapshot,
): CancellationDecisionSnapshot {
  assertNonEmptyId(input.policyVersion, 'cancellation.policyVersion')
  assertNonEmptyId(input.reasonCode, 'cancellation.reasonCode')
  assertNonEmptyId(input.decidedByUid, 'cancellation.decidedByUid')
  requireNonNegative(input.paidAmount, 'paidAmount')
  requireNonNegative(input.retainedAmount, 'retainedAmount')
  requireNonNegative(input.refundableAmount, 'refundableAmount')

  const decomposed = addMoney(input.retainedAmount, input.refundableAmount)
  if (decomposed.amountCents !== input.paidAmount.amountCents) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'Cancellation retained and refundable amounts must equal the paid amount')
  }
  if (input.decision === 'no_charge' && input.retainedAmount.amountCents !== 0) {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'A no-charge cancellation cannot retain money')
  }
  return Object.freeze({
    ...input,
    paidAmount: money(input.paidAmount.amountCents),
    retainedAmount: money(input.retainedAmount.amountCents),
    refundableAmount: money(input.refundableAmount.amountCents),
  })
}

export function requireFundedTip(tip: TipSnapshot): TipSnapshot {
  requirePositive(tip.amount, 'tip.amount')
  return Object.freeze({ ...tip })
}
