import fs from 'node:fs'
import path from 'node:path'
import {
  FinancialDomainError,
  addMoney,
  assertCashClosingTransition,
  assertExpenseTransition,
  assertPaymentTransition,
  assertRefundTransition,
  assertWalkerSettlementTransition,
  buildCancellationDecision,
  buildCashClosing,
  buildPricingSnapshot,
  buildWalkerSettlement,
  calculateEstimatedOperationalResult,
  createFinancialMovement,
  createReversalMovement,
  evaluateIdempotency,
  hasFinancialCapability,
  money,
  multiplyMoney,
  parseIdempotencyKey,
  parseRequestHash,
  ratioOfMoney,
  refundableAmount,
  sumMoney,
  validateExpense,
  validateInternalTicket,
  validatePayment,
  validatePaymentAllocations,
  validateRefundDraft,
  validateTicketReprintRequest,
  type InternalTicket,
  type Money,
  type Payment,
  type PaymentAllocation,
  type PricingSnapshot,
  type Refund,
} from '@/lib/finance/domain'

const KEY = parseIdempotencyKey('test-operation-0001')
const HASH_A = parseRequestHash('a'.repeat(64))
const HASH_B = parseRequestHash('b'.repeat(64))
const AT = '2026-08-08T12:00:00.000Z'

function expectCode(run: () => unknown, code: FinancialDomainError['code']) {
  try {
    run()
    throw new Error(`Expected ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(FinancialDomainError)
    expect((error as FinancialDomainError).code).toBe(code)
  }
}

function payment(status: Payment['status'] = 'confirmed', amountCents = 10_000): Payment {
  return {
    paymentId: 'payment-1',
    customerId: 'customer-1',
    serviceOrderId: 'order-1',
    amount: money(amountCents),
    method: { code: 'test-method', kind: 'other', displayName: 'Método de prueba', referenceMasked: null },
    status,
    idempotencyKey: KEY,
    requestHash: HASH_A,
    createdAt: AT,
    createdByUid: 'cashier-1',
    ...(status === 'confirmed' ? { confirmedAt: AT, confirmedByUid: 'cashier-1' } : {}),
  }
}

function pricing(): PricingSnapshot {
  return buildPricingSnapshot({
    schemaVersion: 1,
    priceVersion: 'test-price-version',
    capturedAt: AT,
    lines: [{
      lineId: 'line-1',
      serviceId: 'service-1',
      description: 'Servicio de prueba',
      quantity: 2,
      unitAmount: money(5_000),
    }],
    discounts: [{
      discountId: 'discount-1',
      kind: 'manual',
      description: 'Descuento de prueba',
      amount: money(1_000),
      policyVersion: 'test-policy',
      approvedByUid: 'admin-1',
    }],
    charges: [{
      chargeId: 'charge-1',
      kind: 'other',
      description: 'Cargo explícito de prueba',
      amount: money(500),
      policyVersion: 'test-policy',
    }],
    tip: {
      amount: money(700),
      declaredByUid: 'customer-1',
      declaredAt: AT,
      treatment: 'pending_professional_definition',
    },
    minimumServiceTotal: money(9_500),
  })
}

describe('F1 Money in integer MXN cents', () => {
  test('accepts safe integer cents and rejects decimals or unsafe values', () => {
    expect(money(123).currency).toBe('MXN')
    expectCode(() => money(1.5), 'INVALID_MONEY')
    expectCode(() => money(Number.MAX_SAFE_INTEGER + 1), 'UNSAFE_INTEGER')
  })

  test('uses integer-safe addition, multiplication, sums and explicit rounding', () => {
    expect(addMoney(money(101), money(202)).amountCents).toBe(303)
    expect(multiplyMoney(money(125), 3).amountCents).toBe(375)
    expect(sumMoney([money(1), money(2), money(3)]).amountCents).toBe(6)
    expect(ratioOfMoney(money(101), 1, 2, 'floor').amountCents).toBe(50)
    expect(ratioOfMoney(money(101), 1, 2, 'half-up').amountCents).toBe(51)
  })

  test('rejects malformed runtime payloads even if a caller bypasses TypeScript', () => {
    const wrongCurrency = { amountCents: 100, currency: 'USD' } as unknown as Money
    const decimalPayload = { amountCents: 1.5, currency: 'MXN' } as unknown as Money
    expectCode(() => addMoney(wrongCurrency, money(1)), 'CURRENCY_MISMATCH')
    expectCode(() => addMoney(decimalPayload, money(1)), 'INVALID_MONEY')
  })
})

describe('F1 immutable pricing and policy snapshots', () => {
  test('calculates only from explicit cents and keeps tips separate', () => {
    const snapshot = pricing()
    expect(snapshot.subtotal.amountCents).toBe(10_000)
    expect(snapshot.discountTotal.amountCents).toBe(1_000)
    expect(snapshot.chargeTotal.amountCents).toBe(500)
    expect(snapshot.serviceTotal.amountCents).toBe(9_500)
    expect(snapshot.grandTotal.amountCents).toBe(10_200)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.lines)).toBe(true)
  })

  test('rejects discounts below the approved minimum without embedding a margin rate', () => {
    expectCode(() => buildPricingSnapshot({
      schemaVersion: 1,
      priceVersion: 'test-price-version',
      capturedAt: AT,
      lines: [{ lineId: 'line-1', serviceId: 'service-1', description: 'Test', quantity: 1, unitAmount: money(10_000) }],
      discounts: [{
        discountId: 'discount-1', kind: 'manual', description: 'Test', amount: money(2_000),
        policyVersion: 'test-policy', approvedByUid: 'admin-1',
      }],
      minimumServiceTotal: money(9_000),
    }), 'MINIMUM_TOTAL_VIOLATION')
  })

  test('requires an exact cancellation decomposition and no-charge means no retention', () => {
    const decision = buildCancellationDecision({
      policyVersion: 'test-policy',
      decision: 'no_charge',
      reasonCode: 'test-reason',
      decidedAt: AT,
      decidedByUid: 'admin-1',
      paidAmount: money(10_000),
      retainedAmount: money(0),
      refundableAmount: money(10_000),
    })
    expect(decision.refundableAmount.amountCents).toBe(10_000)
    expectCode(() => buildCancellationDecision({
      ...decision,
      retainedAmount: money(1),
      refundableAmount: money(9_999),
    }), 'INVALID_SNAPSHOT')
  })
})

describe('F1 payments, allocations and refunds', () => {
  test('validates payments and explicit payment state transitions', () => {
    expect(validatePayment(payment()).status).toBe('confirmed')
    expect(() => assertPaymentTransition('under_review', 'confirmed')).not.toThrow()
    expectCode(() => assertPaymentTransition('confirmed', 'pending'), 'INVALID_STATE_TRANSITION')
    expectCode(() => validatePayment({ ...payment('pending'), confirmedAt: AT }), 'INVALID_SNAPSHOT')
  })

  test('allocates exactly or partially without exceeding a payment', () => {
    const base = payment('confirmed', 10_000)
    const allocations: PaymentAllocation[] = [{
      allocationId: 'allocation-1', paymentId: base.paymentId, targetType: 'serviceOrder',
      targetId: 'order-1', amount: money(10_000), targetFolioSnapshot: null, createdAt: AT,
    }]
    expect(validatePaymentAllocations(base, allocations, 'exact').amountCents).toBe(10_000)
    expectCode(() => validatePaymentAllocations(base, [{ ...allocations[0], amount: money(10_001) }], 'partial'), 'ALLOCATION_EXCEEDS_PAYMENT')
    expectCode(() => validatePaymentAllocations(base, [{ ...allocations[0], amount: money(9_999) }], 'exact'), 'ALLOCATION_TOTAL_MISMATCH')
    expectCode(() => validatePaymentAllocations(base, [
      { ...allocations[0], amount: money(5_000) },
      { ...allocations[0], allocationId: 'allocation-2', amount: money(5_000) },
    ], 'exact'), 'INVALID_ALLOCATION')
  })

  test('allows a refund only up to the remaining confirmed amount', () => {
    const base = payment('confirmed', 10_000)
    const confirmed: Refund = {
      refundId: 'refund-1', paymentId: base.paymentId, amount: money(4_000), reasonCode: 'test-reason',
      status: 'confirmed', idempotencyKey: KEY, requestHash: HASH_A, createdAt: AT, createdByUid: 'admin-1',
    }
    expect(refundableAmount(base, [confirmed]).amountCents).toBe(6_000)
    const draft: Refund = { ...confirmed, refundId: 'refund-2', amount: money(6_000), status: 'requested' }
    expect(validateRefundDraft(base, draft, [confirmed]).amount.amountCents).toBe(6_000)
    expectCode(() => validateRefundDraft(base, { ...draft, amount: money(6_001) }, [confirmed]), 'REFUND_EXCEEDS_AVAILABLE')
    expect(() => assertRefundTransition('under_review', 'confirmed')).not.toThrow()
    expectCode(() => assertRefundTransition('confirmed', 'requested'), 'INVALID_STATE_TRANSITION')
  })
})

describe('F1 immutable ledger', () => {
  test('creates frozen movements and corrections as opposite linked movements', () => {
    const original = createFinancialMovement({
      movementId: 'movement-1', operationId: 'operation-1', sequence: 0,
      type: 'payment_received', direction: 'inflow', amount: money(10_000), effectiveAt: AT,
      sourceType: 'payment', sourceId: 'payment-1', serviceOrderId: 'order-1',
      requestHash: HASH_A, createdAt: AT, createdByUid: 'cashier-1',
    })
    const reversal = createReversalMovement({
      movementId: 'movement-2', operationId: 'operation-2', sequence: 0,
      original, reasonCode: 'test-correction', requestHash: HASH_B, createdAt: AT, createdByUid: 'admin-1',
    })
    expect(Object.isFrozen(original)).toBe(true)
    expect(reversal.direction).toBe('outflow')
    expect(reversal.reversesMovementId).toBe(original.movementId)
    expect(calculateEstimatedOperationalResult([original, reversal]).amountCents).toBe(0)
  })

  test('rejects reversal-shaped edits without an original reference', () => {
    expectCode(() => createFinancialMovement({
      movementId: 'movement-1', operationId: 'operation-1', sequence: 0,
      type: 'reversal', direction: 'outflow', amount: money(1), effectiveAt: AT,
      sourceType: 'payment', sourceId: 'payment-1', reasonCode: 'test',
      requestHash: HASH_A, createdAt: AT, createdByUid: 'admin-1',
    }), 'INVALID_SNAPSHOT')
  })
})

describe('F1 cash, settlements and expenses', () => {
  test('builds a closing snapshot with an explicit difference and no repeated movements', () => {
    const closing = buildCashClosing({
      cashClosingId: 'closing-1', visibleFolio: null, registerId: 'register-1', cashierUid: 'cashier-1',
      windowStart: AT, windowEnd: AT, status: 'draft',
      methodTotals: [{ methodCode: 'test-method', expectedAmount: money(10_000), declaredAmount: money(9_900), movementCount: 1 }],
      movementIds: ['movement-1'], reasonCode: 'test-difference', idempotencyKey: KEY, requestHash: HASH_A, createdAt: AT,
    })
    expect(closing.difference.amountCents).toBe(-100)
    expect(() => assertCashClosingTransition('closing', 'closed')).not.toThrow()
    expectCode(() => assertCashClosingTransition('closed', 'draft'), 'INVALID_STATE_TRANSITION')
  })

  test('builds settlements only from unique session snapshots and explicit amounts', () => {
    const settlement = buildWalkerSettlement({
      settlementId: 'settlement-1', visibleFolio: null, walkerId: 'walker-1', periodStart: AT, periodEnd: AT,
      status: 'draft',
      lines: [{ walkSessionId: 'session-1', serviceOrderId: 'order-1', completedAt: AT, amount: money(5_000), calculationVersion: 'test-version' }],
      adjustments: [{ reasonCode: 'test-adjustment', amount: money(-500) }],
      idempotencyKey: KEY, requestHash: HASH_A, createdAt: AT, createdByUid: 'admin-1',
    })
    expect(settlement.total.amountCents).toBe(4_500)
    expect(() => assertWalkerSettlementTransition('approved', 'paid')).not.toThrow()
    expectCode(() => assertWalkerSettlementTransition('paid', 'draft'), 'INVALID_STATE_TRANSITION')
  })

  test('keeps expense posting and reversal as explicit transitions', () => {
    const expense = validateExpense({
      expenseId: 'expense-1', categoryCode: 'test-category', descriptionSnapshot: 'Gasto de prueba',
      amount: money(1_000), expenseDate: AT, status: 'draft', evidenceReference: null,
      idempotencyKey: KEY, requestHash: HASH_A, createdAt: AT, createdByUid: 'cashier-1',
    })
    expect(expense.amount.amountCents).toBe(1_000)
    expect(() => assertExpenseTransition('posted', 'reversed')).not.toThrow()
    expectCode(() => assertExpenseTransition('reversed', 'draft'), 'INVALID_STATE_TRANSITION')
  })
})

describe('F1 capabilities and idempotency', () => {
  test('requires both the role ceiling and an explicit capability claim', () => {
    expect(hasFinancialCapability('cashier', [], 'finance.payment.record')).toBe(false)
    expect(hasFinancialCapability('cashier', ['finance.payment.record'], 'finance.payment.record')).toBe(true)
    expect(hasFinancialCapability('supervisor', ['finance.payment.refund'], 'finance.payment.refund')).toBe(false)
    expect(hasFinancialCapability('customer', ['finance.payment.read'], 'finance.payment.read')).toBe(true)
  })

  test('returns prior results for identical retries and rejects hash conflicts or in-progress retries', () => {
    expect(evaluateIdempotency(null, HASH_A)).toEqual({ kind: 'new' })
    expect(evaluateIdempotency({
      operationId: 'operation-1', keyHash: HASH_B, requestHash: HASH_A, status: 'succeeded',
      result: { paymentId: 'payment-1' }, createdAt: AT, completedAt: AT,
    }, HASH_A)).toEqual({ kind: 'replay', result: { paymentId: 'payment-1' } })
    expectCode(() => evaluateIdempotency({
      operationId: 'operation-1', keyHash: HASH_B, requestHash: HASH_A, status: 'succeeded',
      result: {}, createdAt: AT,
    }, HASH_B), 'IDEMPOTENCY_CONFLICT')
    expectCode(() => evaluateIdempotency({
      operationId: 'operation-1', keyHash: HASH_B, requestHash: HASH_A, status: 'processing', createdAt: AT,
    }, HASH_A), 'IDEMPOTENCY_IN_PROGRESS')
  })
})

describe('F1 internal ticket contracts', () => {
  test('validates an immutable internal receipt snapshot without treating it as CFDI', () => {
    const ticket: InternalTicket = {
      ticketId: 'ticket-1', visibleFolio: 'TKT-TEST', issueKind: 'original', originalTicketId: null,
      paymentId: 'payment-1', serviceOrderId: 'order-1', walkSessionIds: ['session-1'], movementIds: ['movement-1'],
      reportId: 'report-1',
      brand: { brandName: 'PET Ap', legalDisplayName: 'PET Ap', contactDisplay: null },
      party: { customerDisplayName: 'Cliente', dogDisplayName: 'Perro', serviceDisplayName: 'Servicio', walkerDisplayName: 'Paseador' },
      pricing: pricing(), verificationCode: 'test-verification', verificationUrl: 'https://pet.example/verificar/TKT-TEST',
      issuedAt: AT, issuedByUid: 'cashier-1', printCount: 0, documentKind: 'internal-receipt', isCfdi: false,
    }
    const validated = validateInternalTicket(ticket, 'https://pet.example')
    expect(validated.isCfdi).toBe(false)
    expect(Object.isFrozen(validated)).toBe(true)
    expectCode(() => validateInternalTicket({ ...ticket, verificationUrl: 'https://other.example/ticket' }, 'https://pet.example'), 'INVALID_SNAPSHOT')
    expectCode(() => validateInternalTicket({ ...ticket, verificationUrl: 'https://pet.example/ticket?token=not-allowed' }, 'https://pet.example'), 'INVALID_SNAPSHOT')
  })

  test('models a reprint as a request referencing the same ticket, not a new payment or movement', () => {
    const request = validateTicketReprintRequest({
      ticketId: 'ticket-1', requestedAt: AT, requestedByUid: 'cashier-1',
      reasonCode: 'test-reprint', expectedTicketSnapshotHash: 'test-snapshot-hash',
    })
    expect(request.ticketId).toBe('ticket-1')
    expect(Object.keys(request)).not.toEqual(expect.arrayContaining(['paymentId', 'movementId']))
  })
})

describe('F1 remains a pure domain module', () => {
  test('does not import Firebase, React, browser globals, server routes or printer transports', () => {
    const root = path.resolve(__dirname, '..', 'src/lib/finance/domain')
    const source = fs.readdirSync(root)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
      .join('\n')
    expect(source).not.toMatch(/firebase|react|window\.|document\.|fetch\(|bluetooth|escpos|printer/i)
  })
})
