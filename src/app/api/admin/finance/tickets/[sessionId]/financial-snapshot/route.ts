import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { cloneFinancialSnapshot, type TemporaryTicketFinancialSnapshot } from '@/lib/finance/domain/ticketPreview'
import { FinancialDomainError } from '@/lib/finance/domain/errors'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

/**
 * F4 read-only preview, without touching any ticket
 * document. Tickets remain immutable and created exclusively by the
 * existing T2 client flow (src/lib/tickets.ts) -- this endpoint only reads.
 * An order-level payment is not proof of the total or allocation to a session.
 * Until a trusted allocation/pricing snapshot exists, return unknown amounts.
 * Fail-closed behind FINANCE_PAYMENTS_ENABLED, same as F2/F3.
 */
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = await verifyAdminToken(token)
  if (!adminUid) return NextResponse.json({ code: 'admin-required' }, { status: 403, headers: noStore })

  if (!FEATURE_FLAGS.FINANCE_PAYMENTS_ENABLED) {
    return NextResponse.json({ code: 'finance-payments-not-enabled' }, { status: 503, headers: noStore })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  const { sessionId } = await context.params
  if (!sessionId || sessionId.includes('/')) return NextResponse.json({ code: 'invalid-session-id' }, { status: 400, headers: noStore })

  try {
    const sessionSnap = await firestore.collection('walkSessions').doc(sessionId).get()
    if (!sessionSnap.exists) return NextResponse.json({ code: 'session-not-found' }, { status: 404, headers: noStore })
    const orderId = sessionSnap.data()?.orderId
    if (typeof orderId !== 'string' || !orderId) {
      return NextResponse.json({ code: 'session-missing-order' }, { status: 404, headers: noStore })
    }

    const snapshot: TemporaryTicketFinancialSnapshot = cloneFinancialSnapshot(null)

    return NextResponse.json({ code: 'ok', financial: snapshot, reason: 'allocation-snapshot-unavailable' }, { headers: noStore })
  } catch (cause) {
    if (cause instanceof FinancialDomainError) {
      return NextResponse.json({ code: 'invalid-snapshot', reason: cause.code }, { status: 400, headers: noStore })
    }
    return NextResponse.json({ code: 'snapshot-failed' }, { status: 500, headers: noStore })
  }
}
