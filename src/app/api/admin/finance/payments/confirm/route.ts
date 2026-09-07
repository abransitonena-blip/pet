import { createHash, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { evaluateIdempotency, parseIdempotencyKey, parseRequestHash, type IdempotencyReceipt } from '@/lib/finance/domain/idempotency'
import { FinancialDomainError } from '@/lib/finance/domain/errors'
import { assertPaymentTransition, type Payment } from '@/lib/finance/domain/payments'
import { createFinancialMovement, type FinancialMovement } from '@/lib/finance/domain/ledger'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

/**
 * F3 ledger plumbing: confirming a payment is the only way a
 * `financialMovements` entry is ever created -- there is no endpoint that
 * lets a caller post an arbitrary ledger movement. The amount always comes
 * from the already-recorded payment (F2), never invented here. Fail-closed
 * behind FINANCE_PAYMENTS_ENABLED, same as F2, until the owner approves real
 * payment/ledger business rules.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = await verifyAdminToken(token)
  if (!adminUid) return NextResponse.json({ code: 'admin-required' }, { status: 403, headers: noStore })

  if (!FEATURE_FLAGS.FINANCE_PAYMENTS_ENABLED) {
    return NextResponse.json({ code: 'finance-payments-not-enabled' }, { status: 503, headers: noStore })
  }

  const idempotencyHeader = request.headers.get('idempotency-key') ?? ''
  let idempotencyKey: string
  try {
    idempotencyKey = parseIdempotencyKey(idempotencyHeader)
  } catch {
    return NextResponse.json({ code: 'invalid-idempotency-key' }, { status: 400, headers: noStore })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { paymentId?: unknown }
  try {
    body = await request.json() as { paymentId?: unknown }
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  if (typeof body.paymentId !== 'string' || !body.paymentId) {
    return NextResponse.json({ code: 'invalid-payment-id' }, { status: 400, headers: noStore })
  }

  const requestHash = parseRequestHash(createHash('sha256').update(`confirm:${body.paymentId}:${idempotencyKey}`).digest('hex'))
  const keyHash = parseRequestHash(createHash('sha256').update(idempotencyKey).digest('hex'))
  const idempotencyRef = firestore.collection('financeIdempotency').doc(keyHash)

  try {
    const existingReceipt = await idempotencyRef.get()
    const receipt = existingReceipt.exists ? (existingReceipt.data() as IdempotencyReceipt<{ movementId: string }>) : null
    const decision = evaluateIdempotency<{ movementId: string }>(receipt, requestHash)
    if (decision.kind === 'replay') {
      return NextResponse.json({ code: 'ok', replay: true, result: decision.result }, { headers: noStore })
    }
    if (decision.kind === 'rejected') {
      return NextResponse.json({ code: 'idempotency-rejected' }, { status: 409, headers: noStore })
    }

    const paymentRef = firestore.collection('payments').doc(body.paymentId)
    const sequenceRef = firestore.collection('financeCounters').doc('movementSequence')
    const movementId = randomUUID()
    const movementRef = firestore.collection('financialMovements').doc(movementId)
    const now = new Date().toISOString()

    const movement = await firestore.runTransaction(async (tx) => {
      const paymentSnap = await tx.get(paymentRef)
      if (!paymentSnap.exists) {
        throw new FinancialDomainError('INVALID_SNAPSHOT', 'Payment does not exist')
      }
      const receipt = paymentSnap.data() as IdempotencyReceipt<Payment>
      const payment = receipt.result
      if (!payment) throw new FinancialDomainError('INVARIANT_VIOLATION', 'Payment record has no result payload')

      assertPaymentTransition(payment.status, 'confirmed')

      const sequenceSnap = await tx.get(sequenceRef)
      const nextSequence = (sequenceSnap.exists ? Number(sequenceSnap.data()?.value ?? 0) : 0) + 1

      const createdMovement = createFinancialMovement({
        movementId,
        operationId: payment.paymentId,
        sequence: nextSequence,
        type: 'payment_received',
        direction: 'inflow',
        amount: payment.amount,
        effectiveAt: now,
        sourceType: 'payment',
        sourceId: payment.paymentId,
        serviceOrderId: payment.serviceOrderId,
        requestHash,
        createdAt: now,
        createdByUid: adminUid,
      })

      tx.set(sequenceRef, { value: nextSequence }, { merge: true })
      tx.set(movementRef, createdMovement)
      tx.update(paymentRef, {
        'result.status': 'confirmed',
        'result.confirmedAt': now,
        'result.confirmedByUid': adminUid,
      })
      tx.set(idempotencyRef, {
        operationId: movementId,
        keyHash,
        requestHash,
        status: 'succeeded',
        result: { movementId },
        createdAt: now,
        completedAt: now,
      } satisfies IdempotencyReceipt<{ movementId: string }> & { operationId: string })

      return createdMovement
    })

    return NextResponse.json({ code: 'ok', replay: false, result: { movementId: movement.movementId } }, { headers: noStore })
  } catch (cause) {
    if (cause instanceof FinancialDomainError) {
      return NextResponse.json({ code: 'invalid-confirmation', reason: cause.code }, { status: 400, headers: noStore })
    }
    return NextResponse.json({ code: 'confirmation-failed' }, { status: 500, headers: noStore })
  }
}

export type { FinancialMovement }
