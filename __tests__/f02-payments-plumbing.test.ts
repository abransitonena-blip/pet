import { readFileSync } from 'node:fs'

describe('F2 payment recording: fail-closed plumbing, zero invented amounts', () => {
  const route = readFileSync('src/app/api/admin/finance/payments/route.ts', 'utf8')
  const flags = readFileSync('src/lib/featureFlags.ts', 'utf8')

  test('the FINANCE_PAYMENTS_ENABLED flag defaults to false', () => {
    expect(flags).toContain('FINANCE_PAYMENTS_ENABLED: false')
  })

  test('the flag is checked before any Firestore access, right after auth', () => {
    const authIndex = route.indexOf("status: 403")
    const flagIndex = route.indexOf('FEATURE_FLAGS.FINANCE_PAYMENTS_ENABLED')
    const firestoreIndex = route.indexOf('getPrivilegedFirestore()')
    expect(authIndex).toBeGreaterThan(-1)
    expect(flagIndex).toBeGreaterThan(authIndex)
    expect(firestoreIndex).toBeGreaterThan(flagIndex)
  })

  test('amount and method always come from the request body, never a hardcoded literal', () => {
    expect(route).toContain('body.amountCents as number')
    expect(route).not.toMatch(/amountCents:\s*\d/)
    expect(route).not.toMatch(/ratioOfMoney|multiplyMoney/)
  })

  test('uses the F1 pure-domain validators instead of re-implementing payment rules', () => {
    expect(route).toContain('validatePayment(draft)')
    expect(route).toContain("status: 'pending'")
  })

  test('requires Admin auth and a validated idempotency key before writing', () => {
    expect(route).toContain('verifyAdminToken')
    expect(route).toContain('parseIdempotencyKey')
    expect(route).toContain('evaluateIdempotency')
  })
})
