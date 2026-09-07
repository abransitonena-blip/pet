import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { evaluateIdempotency, parseIdempotencyKey, parseRequestHash, type IdempotencyReceipt } from '@/lib/finance/domain/idempotency'
import { FinancialDomainError } from '@/lib/finance/domain/errors'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

interface AuditResult {
  ok: true
}

/**
 * T3 identity plumbing check, nothing financial. Confirms the Vercel OIDC ->
 * GCP Workload Identity Federation path can obtain a privileged Firestore
 * write, gated by the same Admin ID-token check as every other privileged
 * endpoint, with idempotency. Writes only to `financeAudit/{key}` -- never
 * touches payments, ledger, or any monetary collection. Fails closed (503)
 * when the WIF environment is not configured (e.g. local dev).
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = await verifyAdminToken(token)
  if (!adminUid) return NextResponse.json({ code: 'admin-required' }, { status: 403, headers: noStore })

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

  const requestHash = parseRequestHash(createHash('sha256').update(`t3-identity-check:${idempotencyKey}`).digest('hex'))
  const keyHash = parseRequestHash(createHash('sha256').update(idempotencyKey).digest('hex'))
  const docRef = firestore.collection('financeAudit').doc(keyHash)

  try {
    const existing = await docRef.get()
    const receipt = existing.exists ? (existing.data() as IdempotencyReceipt<AuditResult>) : null
    const decision = evaluateIdempotency<AuditResult>(receipt, requestHash)

    if (decision.kind === 'replay') {
      return NextResponse.json({ code: 'ok', replay: true, result: decision.result }, { headers: noStore })
    }
    if (decision.kind === 'rejected') {
      return NextResponse.json({ code: 'idempotency-rejected' }, { status: 409, headers: noStore })
    }

    const now = new Date().toISOString()
    await docRef.set({
      operationId: keyHash,
      keyHash,
      requestHash,
      status: 'succeeded',
      result: { ok: true },
      requestedBy: adminUid,
      createdAt: now,
      completedAt: now,
    } satisfies IdempotencyReceipt<AuditResult> & { operationId: string; requestedBy: string })

    return NextResponse.json({ code: 'ok', replay: false, result: { ok: true } }, { headers: noStore })
  } catch (cause) {
    if (cause instanceof FinancialDomainError) {
      return NextResponse.json({ code: 'idempotency-conflict', reason: cause.code }, { status: 409, headers: noStore })
    }
    return NextResponse.json({ code: 'identity-check-failed' }, { status: 500, headers: noStore })
  }
}
