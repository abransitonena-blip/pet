import { NextResponse } from 'next/server'
import { verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'
import { ROLES } from '@/lib/roles'
import { sessionsInZones, type ZoneSessionInput } from '@/lib/zoneAdmin'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const SESSION_SCAN_LIMIT = 200
const MAX_ZONES = 20

/**
 * Lo que un administrador de zona ve de su territorio: paseos, quién los
 * lleva, y si ya tienen reporte o ticket. Nunca el nombre, teléfono o
 * dirección de una familia -- decisión del dueño (fase 37): este rol ve lo
 * operativo, no el expediente.
 *
 * `walkSessions` no lleva su propia zona todavía, así que el servidor la
 * resuelve él mismo (sessión → dirección → zona) con su identidad
 * privilegiada: una regla por documento no puede filtrar una lista por un
 * campo que el documento no tiene (ver isMyZoneSession en firestore.rules).
 * Por eso esto vive aquí y no en una consulta directa del cliente.
 */

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const caller = await verifyTokenRole(idToken)
  if (!caller || caller.role !== ROLES.ZONE_ADMIN) {
    return NextResponse.json({ code: 'zone-admin-required' }, { status: 403, headers: noStore })
  }

  const rateLimit = checkRateLimit(`zone-overview:${caller.uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  try {
    const profileSnapshot = await firestore.collection('zoneAdminProfiles').doc(caller.uid).get()
    const profile = profileSnapshot.exists ? profileSnapshot.data() ?? {} : null
    if (!profile || profile.status !== 'active') {
      return NextResponse.json({ code: 'zone-admin-not-active' }, { status: 403, headers: noStore })
    }
    const myZones: string[] = Array.isArray(profile.zones)
      ? profile.zones.filter((zone: unknown): zone is string => typeof zone === 'string').slice(0, MAX_ZONES)
      : []
    if (myZones.length === 0) {
      return NextResponse.json({ code: 'ok', zones: [], sessions: [] }, { headers: noStore })
    }

    const zonesSnapshot = await firestore.getAll(...myZones.map((id) => firestore.collection('zones').doc(id)))
    const zoneNames = new Map(zonesSnapshot.flatMap((item) => item.exists ? [[item.id, text(item.data()?.name) || item.id] as const] : []))

    const sessionsSnapshot = await firestore.collection('walkSessions')
      .orderBy('scheduledDate', 'desc').limit(SESSION_SCAN_LIMIT).get()
    const candidates: ZoneSessionInput[] = sessionsSnapshot.docs.flatMap((item) => {
      const data = item.data()
      const addressId = text(data.addressId)
      if (!addressId) return []
      return [{
        id: item.id,
        status: text(data.status),
        scheduledDate: text(data.scheduledDate),
        addressId,
        walkerId: text(data.walkerId),
        dogCount: Array.isArray(data.dogIds) ? data.dogIds.length : 0,
      }]
    })

    const addressIds = Array.from(new Set(candidates.map((item) => item.addressId)))
    const addressesSnapshot = addressIds.length > 0
      ? await firestore.getAll(...addressIds.map((id) => firestore.collection('addresses').doc(id)))
      : []
    const addressZones = new Map(addressesSnapshot.flatMap((item) => {
      const zoneId = text(item.data()?.zoneId)
      return zoneId ? [[item.id, zoneId] as const] : []
    }))

    const zoneSessions = sessionsInZones(candidates, addressZones, myZones)

    const walkerIds = Array.from(new Set(zoneSessions.map((item) => item.walkerId).filter(Boolean)))
    const walkersSnapshot = walkerIds.length > 0
      ? await firestore.getAll(...walkerIds.map((id) => firestore.collection('walkerProfiles').doc(id)))
      : []
    const walkerNames = new Map(walkersSnapshot.flatMap((item) => item.exists ? [[item.id, text(item.data()?.name) || 'Paseador'] as const] : []))

    const [reportsSnapshot, ticketsSnapshot] = zoneSessions.length > 0
      ? await Promise.all([
        firestore.getAll(...zoneSessions.map((item) => firestore.collection('walkReports').doc(item.id))),
        firestore.getAll(...zoneSessions.map((item) => firestore.collection('tickets').doc(item.id))),
      ])
      : [[], []]
    const reportStatusById = new Map(reportsSnapshot.map((item) => [item.id, item.exists ? text(item.data()?.status) || 'draft' : 'none']))
    const hasTicketById = new Map(ticketsSnapshot.map((item) => [item.id, item.exists]))

    const sessions = zoneSessions.map((session) => ({
      id: session.id,
      status: session.status,
      scheduledDate: session.scheduledDate,
      zoneId: session.zoneId,
      zoneName: zoneNames.get(session.zoneId) ?? session.zoneId,
      walkerId: session.walkerId || null,
      walkerName: session.walkerId ? walkerNames.get(session.walkerId) ?? null : null,
      dogCount: session.dogCount,
      reportStatus: reportStatusById.get(session.id) ?? 'none',
      hasTicket: hasTicketById.get(session.id) ?? false,
    }))

    return NextResponse.json({
      code: 'ok',
      zones: myZones.map((id) => ({ id, name: zoneNames.get(id) ?? id })),
      sessions,
    }, { headers: noStore })
  } catch (error) {
    console.error('zone/overview failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'zone-overview-failed' }, { status: 500, headers: noStore })
  }
}
