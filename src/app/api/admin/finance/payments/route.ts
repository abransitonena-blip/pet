import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { evaluateIdempotency, parseIdempotencyKey, parseRequestHash, type IdempotencyReceipt } from '@/lib/finance/domain/idempotency'
import { FinancialDomainError } from '@/lib/finance/domain/errors'
import { validatePayment, type Payment, type PaymentMethodSnapshot } from '@/lib/finance/domain/payments'
import { money } from '@/lib/finance/domain/money'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

interface RecordPaymentBody {
  paymentId?: unknown
  customerId?: unknown
  serviceOrderId?: unknown
  amountCents?: unknown
  method?: { code?: unknown; kind?: unknown; displayName?: unknown; referenceMasked?: unknown }
}

function parseMethod(input: RecordPaymentBody['method']): PaymentMethodSnapshot {
  const kind = input?.kind
  if (kind !== 'cash' && kind !== 'electronic' && kind !== 'other') {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'method.kind must be cash, electronic, or other')
  }
  if (typeof input?.code !== 'string' || typeof input?.displayName !== 'string') {
    throw new FinancialDomainError('INVALID_SNAPSHOT', 'method.code and method.displayName are required strings')
  }
  return {
    code: input.code,
    kind,
    displayName: input.displayName,
    referenceMasked: typeof input.referenceMasked === 'string' ? input.referenceMasked : null,
  }
}

/**
 * F2 payment recording, fail-closed behind FINANCE_PAYMENTS_ENABLED. The
 * amount and method always come from the caller (Admin recording a real,
 * already-completed manual payment) -- this endpoint never invents or
 * hardcodes a price, commission, or fee. It stays disabled until the owner
 * approves real business rules for what counts as a valid payment record;
 * until then it always returns 503 without touching Firestore.
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

  let body: RecordPaymentBody
  try {
    body = await request.json() as RecordPaymentBody
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }

  try {
    if (![body.paymentId, body.customerId, body.serviceOrderId].every((id) => typeof id === 'string' && id.length > 0 && id.length <= 128 && !id.includes('/'))) {
      throw new FinancialDomainError('INVALID_SNAPSHOT', 'paymentId, customerId, and serviceOrderId are required strings')
    }
    if (!Number.isSafeInteger(body.amountCents)) {
      throw new FinancialDomainError('INVALID_MONEY', 'amountCents must be a safe integer number of cents')
    }

    const draft: Payment = {
      paymentId: body.paymentId as string,
      customerId: body.customerId as string,
      serviceOrderId: body.serviceOrderId as string,
      amount: money(body.amountCents as number),
      method: parseMethod(body.method),
      status: 'pending',
      idempotencyKey: idempotencyKey as Payment['idempotencyKey'],
      requestHash: parseRequestHash(createHash('sha256').update(JSON.stringify({
        operation: 'record-payment', adminUid, paymentId: body.paymentId, customerId: body.customerId,
        serviceOrderId: body.serviceOrderId, amountCents: body.amountCents, method: parseMethod(body.method),
      })).digest('hex')),
      createdAt: new Date().toISOString(),
      createdByUid: adminUid,
    }
    const validated = validatePayment(draft)

    const keyHash = parseRequestHash(createHash('sha256').update(`record:${adminUid}:${idempotencyKey}`).digest('hex'))
    const docRef = firestore.collection('payments').doc(validated.paymentId)
    const keyRef = firestore.collection('financeIdempotency').doc(keyHash)
    return await firestore.runTransaction(async (tx) => {
    const keySnapshot = await tx.get(keyRef)
    const existing = await tx.get(docRef)
    const keyDecision = evaluateIdempotency<Payment>(keySnapshot.exists ? keySnapshot.data() as IdempotencyReceipt<Payment> : null, validated.requestHash)
    if (keyDecision.kind === 'replay') return NextResponse.json({ code: 'ok', replay: true, payment: keyDecision.result }, { headers: noStore })
    if (keyDecision.kind === 'rejected') return NextResponse.json({ code: 'idempotency-rejected' }, { status: 409, headers: noStore })
    const receipt = existing.exists ? (existing.data() as IdempotencyReceipt<Payment>) : null
    const decision = evaluateIdempotency<Payment>(receipt, validated.requestHash)

    if (decision.kind === 'replay') {
      // Reserve this key even when it replays an already existing payment.
      // Otherwise the same key could subsequently create a different payment.
      tx.create(keyRef, { ...receipt, keyHash })
      return NextResponse.json({ code: 'ok', replay: true, payment: decision.result }, { headers: noStore })
    }
    if (decision.kind === 'rejected') {
      return NextResponse.json({ code: 'idempotency-rejected' }, { status: 409, headers: noStore })
    }

    const order = await tx.get(firestore.collection('serviceOrders').doc(validated.serviceOrderId))
    if (!order.exists || order.data()?.customerId !== validated.customerId) {
      throw new FinancialDomainError('INVALID_SNAPSHOT', 'Order/customer mismatch')
    }

    const now = new Date().toISOString()
    const stored = {
      operationId: validated.paymentId,
      keyHash,
      requestHash: validated.requestHash,
      status: 'succeeded',
      result: validated,
      createdAt: now,
      completedAt: now,
    } satisfies IdempotencyReceipt<Payment> & { operationId: string }
    tx.create(docRef, stored)
    tx.create(keyRef, stored)

    return NextResponse.json({ code: 'ok', replay: false, payment: validated }, { headers: noStore })
    })
  } catch (cause) {
    if (cause instanceof FinancialDomainError) {
      return NextResponse.json({ code: 'invalid-payment', reason: cause.code }, { status: cause.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 400, headers: noStore })
    }
    return NextResponse.json({ code: 'payment-record-failed' }, { status: 500, headers: noStore })
  }
}
