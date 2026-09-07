import { existsSync, readFileSync } from 'node:fs'

describe('F3 ledger: the only path to a financial movement is confirming a real payment', () => {
  const route = readFileSync('src/app/api/admin/finance/payments/confirm/route.ts', 'utf8')

  test('fails closed behind the same FINANCE_PAYMENTS_ENABLED flag as F2', () => {
    expect(route).toContain('FEATURE_FLAGS.FINANCE_PAYMENTS_ENABLED')
    expect(route).toContain("status: 503")
  })

  test('the movement amount is read from the existing payment record, never re-entered by the caller', () => {
    expect(route).toContain('amount: payment.amount')
    expect(route).not.toMatch(/body\.amount/)
  })

  test('uses createFinancialMovement (F1 domain) instead of writing a raw movement object', () => {
    expect(route).toContain('createFinancialMovement(')
    expect(route).toContain("type: 'payment_received'")
    expect(route).toContain("direction: 'inflow'")
  })

  test('validates the payment state transition before writing anything', () => {
    expect(route).toContain("assertPaymentTransition(payment.status, 'confirmed')")
  })

  test('the payment update, movement creation, sequence counter, and idempotency receipt are one atomic transaction', () => {
    expect(route).toContain('firestore.runTransaction(async (tx)')
    expect(route).toContain('tx.set(movementRef')
    expect(route).toContain('tx.set(sequenceRef')
    expect(route).toContain('tx.update(paymentRef')
    expect(route).toContain('tx.set(idempotencyRef')
  })

  test('there is no separate endpoint that lets a caller post an arbitrary ledger movement', () => {
    expect(existsSync('src/app/api/admin/finance/movements')).toBe(false)
  })
})
