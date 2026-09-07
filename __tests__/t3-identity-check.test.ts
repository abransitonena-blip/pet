import { readFileSync } from 'node:fs'

describe('T3 identity check: fail-closed plumbing with zero financial mutation', () => {
  const route = readFileSync('src/app/api/admin/finance/t3-identity-check/route.ts', 'utf8')
  const serverFirestore = readFileSync('src/lib/finance/serverFirestore.ts', 'utf8')
  const serverIdentity = readFileSync('src/lib/finance/serverIdentity.ts', 'utf8')

  test('requires a Bearer token and the Admin claim before anything else', () => {
    expect(route).toContain("export const runtime = 'nodejs'")
    expect(route.indexOf("if (!token) return NextResponse.json({ code: 'auth-required' }")).toBeLessThan(
      route.indexOf('getPrivilegedFirestore()'),
    )
    expect(route).toContain('verifyAdminToken')
    expect(route).toContain("status: 403")
  })

  test('validates the idempotency key and hashes it before using it as a document id', () => {
    expect(route).toContain('parseIdempotencyKey')
    expect(route).toContain('parseRequestHash')
    expect(route).toContain("createHash('sha256')")
  })

  test('fails closed with 503 when the Workload Identity Federation environment is not configured', () => {
    expect(route).toContain("if (!firestore) {")
    expect(route).toContain("status: 503")
    expect(serverFirestore).toContain('cached = null')
    expect(serverFirestore).toContain('return cached')
  })

  test('never writes to payment, ledger, or wallet collections -- audit only', () => {
    expect(route).toContain("collection('financeAudit')")
    expect(route).not.toMatch(/collection\(['"](payments|ledger|wallets|financialMovements)['"]\)/)
    expect(route).not.toContain('amountCents')
    expect(route).not.toContain('commission')
  })

  test('the privileged Firestore client uses short-lived OIDC exchange, never a stored service-account key', () => {
    expect(serverFirestore).toContain('getPrivilegedAuthClient')
    expect(serverIdentity).toContain('ExternalAccountClient')
    expect(serverIdentity).toContain('getVercelOidcToken')
    expect(serverFirestore).not.toContain('FIREBASE_SERVICE_ACCOUNT_JSON')
    expect(serverIdentity).not.toContain('FIREBASE_SERVICE_ACCOUNT_JSON')
    expect(serverFirestore).not.toMatch(/private_key/i)
    expect(serverIdentity).not.toMatch(/private_key/i)
  })
})
