import { readFileSync } from 'node:fs'

describe('F4 ticket financial snapshot: read-only, never touches an immutable ticket', () => {
  const route = readFileSync('src/app/api/admin/finance/tickets/[sessionId]/financial-snapshot/route.ts', 'utf8')
  const ticketsClient = readFileSync('src/lib/tickets.ts', 'utf8')

  test('is a GET (read-only) handler, not a write', () => {
    expect(route).toContain('export async function GET(')
    expect(route).not.toContain('export async function POST(')
    expect(route).not.toContain(".collection('tickets')")
  })

  test('fails closed behind FINANCE_PAYMENTS_ENABLED, same as F2/F3', () => {
    expect(route).toContain('FEATURE_FLAGS.FINANCE_PAYMENTS_ENABLED')
    expect(route).toContain('status: 503')
  })

  test('does not mistake collected payments for a reliable session price or settled balance', () => {
    expect(route).toContain('cloneFinancialSnapshot(null)')
    expect(route).toContain('allocation-snapshot-unavailable')
    expect(route).not.toContain("paymentStatus: 'paid'")
    expect(route).not.toContain('sumMoney')
  })

  test('validates the computed snapshot through the same F1 invariant used by real ticket creation', () => {
    expect(route).toContain('cloneFinancialSnapshot(')
  })

  test('ticket creation itself (T2, src/lib/tickets.ts) is untouched by this change', () => {
    expect(ticketsClient).not.toContain('financial-snapshot')
    expect(ticketsClient).not.toContain('FINANCE_PAYMENTS_ENABLED')
  })
})
