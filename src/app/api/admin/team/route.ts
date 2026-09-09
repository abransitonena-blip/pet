import { NextResponse } from 'next/server'
import { FieldValue } from '@google-cloud/firestore'
import { verifyAdminToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import {
  findUserByEmail,
  identityFailureMessage,
  setUserRoleClaim,
  type IdentityFailure,
} from '@/lib/admin/identityToolkit.server'
import { ROLES, type Role } from '@/lib/roles'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const MAX_NAME = 120
const MAX_PHONE = 24
const MAX_ZONES = 20

type WalkerStatus = 'active' | 'inactive' | 'suspended'

const ASSIGNABLE_ROLES: readonly Role[] = [ROLES.CUSTOMER, ROLES.WALKER, ROLES.SUPERVISOR, ROLES.ADMIN]
const WALKER_STATUSES: readonly WalkerStatus[] = ['active', 'inactive', 'suspended']

/**
 * Team provisioning, Admin-only. Replaces the `setUserRole` Cloud Function
 * that could never be deployed (no billing account): the role claim is
 * written through the Identity Toolkit REST API instead, and the operational
 * `walkerProfiles` document through the same privileged Firestore client the
 * finance endpoints use. See identityToolkit.server.ts.
 *
 * It never creates accounts and never sets passwords -- the person signs up
 * themselves, then an admin grants the role. That keeps credential handling
 * entirely out of this codebase.
 *
 * `action: 'lookup'` reports what an email currently resolves to, so the
 * admin sees the real state before changing anything. Sent as a POST body,
 * not a query string, to keep the address out of URLs and logs.
 */
function failureStatus(reason: IdentityFailure): number {
  if (reason === 'user-not-found') return 404
  if (reason === 'not-configured' || reason === 'permission-denied') return 503
  return 502
}

function cleanString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = await verifyAdminToken(token)
  if (!adminUid) return NextResponse.json({ code: 'admin-required' }, { status: 403, headers: noStore })

  let body: {
    action?: unknown
    email?: unknown
    role?: unknown
    name?: unknown
    phone?: unknown
    zones?: unknown
    status?: unknown
  }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }

  const email = cleanString(body.email, MAX_NAME).toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ code: 'invalid-email' }, { status: 400, headers: noStore })
  }

  const found = await findUserByEmail(email)
  if (!found.ok) {
    return NextResponse.json(
      { code: found.reason, message: identityFailureMessage(found.reason) },
      { status: failureStatus(found.reason), headers: noStore },
    )
  }
  const account = found.value

  if (body.action === 'lookup') {
    return NextResponse.json({ code: 'ok', user: account }, { headers: noStore })
  }

  const role = ASSIGNABLE_ROLES.find((candidate) => candidate === body.role)
  if (!role) {
    return NextResponse.json({ code: 'invalid-role' }, { status: 400, headers: noStore })
  }

  // An admin demoting themselves would lock the whole panel out, and only
  // another admin could undo it -- so refuse rather than let it happen.
  if (account.uid === adminUid && role !== ROLES.ADMIN) {
    return NextResponse.json({ code: 'self-demotion-blocked' }, { status: 409, headers: noStore })
  }

  const claimResult = await setUserRoleClaim(account.uid, role)
  if (!claimResult.ok) {
    return NextResponse.json(
      { code: claimResult.reason, message: identityFailureMessage(claimResult.reason) },
      { status: failureStatus(claimResult.reason), headers: noStore },
    )
  }

  let walkerProfileWritten = false
  if (role === ROLES.WALKER) {
    const firestore = getPrivilegedFirestore()
    if (!firestore) {
      // The claim landed but the operational profile did not: say so instead
      // of reporting success, because isActiveWalker() needs both.
      return NextResponse.json(
        { code: 'profile-not-written', user: claimResult.value, message: identityFailureMessage('not-configured') },
        { status: 503, headers: noStore },
      )
    }

    const status = WALKER_STATUSES.find((candidate) => candidate === body.status) ?? 'inactive'
    const zones = Array.isArray(body.zones)
      ? body.zones.filter((zone): zone is string => typeof zone === 'string' && zone.trim().length > 0)
        .map((zone) => zone.trim())
        .slice(0, MAX_ZONES)
      : []

    const profileRef = firestore.collection('walkerProfiles').doc(account.uid)
    const existing = await profileRef.get()
    const previous = existing.exists ? existing.data() ?? {} : {}

    await profileRef.set({
      ...previous,
      name: cleanString(body.name, MAX_NAME) || String(previous.name ?? '') || account.displayName || account.email,
      email: account.email,
      phone: cleanString(body.phone, MAX_PHONE) || String(previous.phone ?? ''),
      zones: zones.length > 0 ? zones : (Array.isArray(previous.zones) ? previous.zones : []),
      schedule: previous.schedule ?? {},
      status,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: previous.createdAt ?? FieldValue.serverTimestamp(),
      provisionedBy: adminUid,
    })
    walkerProfileWritten = true
  }

  return NextResponse.json(
    { code: 'ok', user: claimResult.value, walkerProfileWritten },
    { headers: noStore },
  )
}
