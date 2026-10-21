import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from '@google-cloud/firestore'
import { verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'
import { ROLES } from '@/lib/roles'
import { MAX_NOTE_LENGTH, validateDelivery } from '@/lib/zoneSupplies'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * Un administrador de zona entrega suministros a un paseador.
 *
 * El stock sólo baja desde aquí, nunca desde un `updateDoc` en el navegador
 * (ver firestore.rules: `zoneSupplies` sólo admite create/update de admin).
 * Una transacción lee el stock, lo valida y lo decrementa en el mismo paso
 * que escribe la bitácora -- las dos cosas o ninguna, nunca una entrega
 * registrada sin que el stock haya bajado, ni al revés.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const caller = await verifyTokenRole(idToken)
  if (!caller || caller.role !== ROLES.ZONE_ADMIN) {
    return NextResponse.json({ code: 'zone-admin-required' }, { status: 403, headers: noStore })
  }

  const rateLimit = checkRateLimit(`zone-deliver:${caller.uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { supplyId?: unknown; walkerId?: unknown; quantity?: unknown; note?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  const supplyId = typeof body.supplyId === 'string' ? body.supplyId.trim() : ''
  const walkerId = typeof body.walkerId === 'string' ? body.walkerId.trim() : ''
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE_LENGTH) : ''
  if (!supplyId || supplyId.includes('/') || !walkerId || walkerId.includes('/')) {
    return NextResponse.json({ code: 'invalid-request' }, { status: 400, headers: noStore })
  }

  try {
    const profileSnapshot = await firestore.collection('zoneAdminProfiles').doc(caller.uid).get()
    const profile = profileSnapshot.exists ? profileSnapshot.data() ?? {} : null
    if (!profile || profile.status !== 'active') {
      return NextResponse.json({ code: 'zone-admin-not-active' }, { status: 403, headers: noStore })
    }
    const myZones: string[] = Array.isArray(profile.zones)
      ? profile.zones.filter((zone: unknown): zone is string => typeof zone === 'string')
      : []

    const walkerSnapshot = await firestore.collection('walkerProfiles').doc(walkerId).get()
    if (!walkerSnapshot.exists || walkerSnapshot.data()?.status !== 'active') {
      return NextResponse.json({ code: 'walker-not-active' }, { status: 409, headers: noStore })
    }
    const walkerName = typeof walkerSnapshot.data()?.name === 'string' && walkerSnapshot.data()?.name ? walkerSnapshot.data()?.name : 'Paseador'

    const supplyRef = firestore.collection('zoneSupplies').doc(supplyId)
    const deliveryRef = firestore.collection('zoneSupplyDeliveries').doc()

    const result = await firestore.runTransaction(async (transaction) => {
      const supplySnapshot = await transaction.get(supplyRef)
      if (!supplySnapshot.exists) return { kind: 'not-found' as const }
      const supply = supplySnapshot.data() ?? {}
      const zoneId = typeof supply.zoneId === 'string' ? supply.zoneId : ''
      if (!zoneId || !myZones.includes(zoneId)) return { kind: 'not-found' as const }

      const currentStock = typeof supply.stock === 'number' ? supply.stock : 0
      const validation = validateDelivery(body.quantity, currentStock)
      if (!validation.ok) return { kind: validation.code }

      const quantity = body.quantity as number
      const nextStock = currentStock - quantity
      transaction.update(supplyRef, { stock: nextStock, updatedAt: Timestamp.now(), updatedBy: caller.uid })
      transaction.set(deliveryRef, {
        zoneId,
        supplyId,
        itemName: typeof supply.itemName === 'string' ? supply.itemName : '',
        quantity,
        walkerId,
        walkerName,
        deliveredBy: caller.uid,
        deliveredAt: FieldValue.serverTimestamp(),
        note,
      })
      return { kind: 'ok' as const, stock: nextStock }
    })

    if (result.kind === 'not-found') return NextResponse.json({ code: 'not-found' }, { status: 404, headers: noStore })
    if (result.kind === 'invalid-quantity') return NextResponse.json({ code: 'invalid-quantity' }, { status: 400, headers: noStore })
    if (result.kind === 'insufficient-stock') return NextResponse.json({ code: 'insufficient-stock' }, { status: 409, headers: noStore })

    return NextResponse.json({ code: 'ok', stock: result.stock }, { headers: noStore })
  } catch (error) {
    console.error('zone/supplies/deliver failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'deliver-failed' }, { status: 500, headers: noStore })
  }
}
