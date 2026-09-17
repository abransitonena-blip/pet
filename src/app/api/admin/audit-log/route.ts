import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const VALID_ACTIONS = new Set(['create', 'update', 'delete', 'assign', 'cancel', 'complete'])
const VALID_ENTITIES = new Set(['reservation', 'serviceOrder', 'walkSession', 'coupon', 'customer', 'walker', 'review'])
const MAX_ENTITY_ID_LENGTH = 200

const SKIP_KEYS = new Set(['notes', 'internalNotes', 'walkNotes', 'photos', 'history'])

function sanitize(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  const clean: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SKIP_KEYS.has(key)) continue
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null) {
      clean[key] = item
    }
  }
  return clean
}

/**
 * An admin-authored audit log written from the admin's own browser proves
 * nothing -- anyone with devtools open can fabricate one. This writes it
 * server-side instead: the actor is the verified token's uid, never a
 * client-supplied field, via the T3 privileged client. See firestore.rules'
 * `audit-logs` match block (create/update/delete: if false).
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = await verifyAdminToken(token)
  if (!adminUid) return NextResponse.json({ code: 'admin-required' }, { status: 403, headers: noStore })

  const firestore = getPrivilegedFirestore()
  if (!firestore) return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })

  let body: { action?: unknown; entity?: unknown; entityId?: unknown; before?: unknown; after?: unknown; meta?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }

  const action = typeof body.action === 'string' ? body.action : ''
  const entity = typeof body.entity === 'string' ? body.entity : ''
  const entityId = typeof body.entityId === 'string' ? body.entityId.slice(0, MAX_ENTITY_ID_LENGTH) : ''
  if (!VALID_ACTIONS.has(action) || !VALID_ENTITIES.has(entity) || !entityId) {
    return NextResponse.json({ code: 'invalid-entry' }, { status: 400, headers: noStore })
  }

  try {
    const logRef = firestore.collection('audit-logs').doc()
    await logRef.set({
      actor: { uid: adminUid },
      action,
      entity,
      entityId,
      before: sanitize(body.before),
      after: sanitize(body.after),
      meta: sanitize(body.meta),
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ code: 'ok' }, { headers: noStore })
  } catch {
    return NextResponse.json({ code: 'log-failed' }, { status: 500, headers: noStore })
  }
}
