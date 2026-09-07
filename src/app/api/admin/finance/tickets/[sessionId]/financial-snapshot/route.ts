import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { money, sumMoney } from '@/lib/finance/domain/money'
import { cloneFinancialSnapshot, type TemporaryTicketFinancialSnapshot } from '@/lib/finance/domain/ticketPreview'
import { FinancialDomainError } from '@/lib/finance/domain/errors'
import type { IdempotencyReceipt } from '@/lib/finance/domain/idempotency'
import type { Payment } from '@/lib/finance/domain/payments'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

/**
 * F4 read-only preview: computes what a ticket's financial snapshot would
 * look like from confirmed F2/F3 payments, without touching any ticket
 * document. Tickets remain immutable and created exclusively by the
 * existing T2 client flow (src/lib/tickets.ts) -- this endpoint only reads.
 * Reports recorded amounts as-is; invents no discount, tip, or commission.
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
  if (!sessionId) return NextResponse.json({ code: 'invalid-session-id' }, { status: 400, headers: noStore })

  try {
    const sessionSnap = await firestore.collection('walkSessions').doc(sessionId).get()
    if (!sessionSnap.exists) return NextResponse.json({ code: 'session-not-found' }, { status: 404, headers: noStore })
    const orderId = sessionSnap.data()?.orderId
    if (typeof orderId !== 'string' || !orderId) {
      return NextResponse.json({ code: 'session-missing-order' }, { status: 404, headers: noStore })
    }

    const paymentsSnap = await firestore.collection('payments').where('result.serviceOrderId', '==', orderId).limit(50).get()
    const confirmedPayments = paymentsSnap.docs
      .map((paymentDoc) => (paymentDoc.data() as IdempotencyReceipt<Payment>).result)
      .filter((payment): payment is Payment => payment !== undefined && payment.status === 'confirmed')

    const total = confirmedPayments.length > 0
      ? sumMoney(confirmedPayments.map((payment) => payment.amount))
      : null

    const snapshot: TemporaryTicketFinancialSnapshot = cloneFinancialSnapshot(total === null ? null : {
      reliable: true,
      subtotal: total,
      discount: money(0),
      tip: null,
      total,
      amountPaid: total,
      balanceDue: money(0),
      paymentMethod: confirmedPayments[0]?.method.displayName ?? null,
      paymentStatus: 'paid',
      complimentary: false,
    })

    return NextResponse.json({ code: 'ok', financial: snapshot }, { headers: noStore })
  } catch (cause) {
    if (cause instanceof FinancialDomainError) {
      return NextResponse.json({ code: 'invalid-snapshot', reason: cause.code }, { status: 400, headers: noStore })
    }
    return NextResponse.json({ code: 'snapshot-failed' }, { status: 500, headers: noStore })
  }
}
