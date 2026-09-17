import { NextResponse } from 'next/server'
import { verifyWalkerToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'
import { vaccineStatus, type VaccineStatus } from '@/lib/dogHealth'
import { isDogPhotoReference } from '@/lib/dogPhotos'
import { createPrivateDownloadUrl } from '@/lib/media/privateMediaAdmin.server'
import type { ZoneSpot } from '@/types'
import { dateInTimezone } from '@/lib/bookingSchedule'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const MAX_DOGS = 5
const PHOTO_TTL_SECONDS = 600
const VISIBLE_STATUSES: ReadonlySet<string> = new Set([
  'assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress', 'completed',
])

/**
 * Ficha del paseo para el paseador asignado.
 *
 * Las reglas no dejan que un paseador lea `dogs` ni `addresses` -- ahí vive el
 * expediente y el domicilio de la familia. Pero para salir a pasear necesita
 * saber si el perro es alérgico, si toma medicamento y qué cuidados tiene, y
 * dónde puede pasearlo.
 *
 * El servidor lo resuelve: confirma que el paseo es suyo y devuelve solo los
 * campos de cuidado del perro y los lugares marcados de la zona. Nunca la
 * dirección, ni el teléfono de la familia, ni nada del resto del expediente.
 *
 * Desde aquí también sale la foto del perro, si la familia subió una: quien va a
 * recogerlo necesita reconocerlo en la puerta. Va como enlace que caduca, igual
 * que para la familia, y sólo mientras el paseo siga asignado a esa persona.
 *
 * Solo mientras el paseo está asignado o en curso (y al cerrarlo, para el
 * reporte). Falla cerrado: sin identidad privilegiada no responde nada.
 */

interface DogSheet {
  name: string
  breed: string
  size: string
  sex: string
  age: string
  weight: string
  energyLevel: string
  temperament: string[]
  allergies: string[]
  medications: string[]
  specialNeeds: string
  vetName: string
  vetPhone: string
  vaccines: { name: string; date: string; nextDue: string; status: VaccineStatus }[]
  /** Enlace que caduca a la foto del perro, o '' si la familia no ha subido una. */
  photoUrl: string
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
    : []
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function dogSheetFrom(data: Record<string, unknown>, today: string): DogSheet {
  const health = record(data.health)
  const personality = record(data.personality)
  const preferences = record(data.preferences)
  const vaccines = Array.isArray(health.vaccines) ? health.vaccines.map(record) : []
  return {
    name: text(data.name) || 'Perro sin nombre',
    breed: text(data.breed),
    size: text(data.size),
    sex: text(data.sex),
    age: text(data.age),
    weight: text(data.weight),
    energyLevel: text(personality.energyLevel),
    temperament: list(personality.temperament),
    allergies: list(health.allergies),
    medications: list(health.medications),
    specialNeeds: text(preferences.specialNeeds),
    vetName: text(health.vetName),
    vetPhone: text(health.vetPhone),
    vaccines: vaccines
      .map((vaccine) => {
        const nextDue = text(vaccine.nextDue)
        return {
          name: text(vaccine.name),
          date: text(vaccine.date),
          nextDue,
          status: vaccineStatus({ nextDue }, today),
        }
      })
      .filter((vaccine) => vaccine.name !== ''),
    photoUrl: dogPhotoUrl(data.photoReference),
  }
}

/** Un enlace temporal a la foto, cuando existe y cuando Cloudinary está configurado. */
function dogPhotoUrl(reference: unknown): string {
  if (!isDogPhotoReference(reference)) return ''
  try {
    return createPrivateDownloadUrl(reference, { ttlSeconds: PHOTO_TTL_SECONDS })
  } catch {
    // Sin credenciales de Cloudinary la ficha sigue sirviendo: es la foto lo que falta.
    return ''
  }
}

function spotsFrom(value: unknown): ZoneSpot[] {
  if (!Array.isArray(value)) return []
  return value
    .map(record)
    .map((spot) => ({
      id: text(spot.id) || text(spot.name),
      name: text(spot.name),
      kind: (text(spot.kind) || 'recomendado') as ZoneSpot['kind'],
      lat: typeof spot.lat === 'number' ? spot.lat : Number.NaN,
      lng: typeof spot.lng === 'number' ? spot.lng : Number.NaN,
      ...(text(spot.note) ? { note: text(spot.note) } : {}),
    }))
    .filter((spot) => spot.name !== '' && Number.isFinite(spot.lat) && Number.isFinite(spot.lng))
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const walkerUid = await verifyWalkerToken(idToken)
  if (!walkerUid) return NextResponse.json({ code: 'walker-required' }, { status: 403, headers: noStore })

  const rateLimit = checkRateLimit(`walk-sheet:${walkerUid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { sessionId?: unknown; today?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
    ? body.today
    // Sin fecha del cliente, la del negocio: en UTC, a partir de las seis de la
    // tarde en México "hoy" ya sería mañana.
    : dateInTimezone(Date.now())
  if (!sessionId || sessionId.includes('/')) {
    return NextResponse.json({ code: 'invalid-session-id' }, { status: 400, headers: noStore })
  }

  try {
    const sessionSnapshot = await firestore.collection('walkSessions').doc(sessionId).get()
    const session = sessionSnapshot.exists ? sessionSnapshot.data() ?? {} : null
    if (!session || session.walkerId !== walkerUid) {
      return NextResponse.json({ code: 'session-not-assigned' }, { status: 403, headers: noStore })
    }
    if (!VISIBLE_STATUSES.has(String(session.status ?? ''))) {
      return NextResponse.json({ code: 'session-not-active' }, { status: 409, headers: noStore })
    }

    const dogIds = Array.isArray(session.dogIds)
      ? session.dogIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, MAX_DOGS)
      : []
    const dogSnapshots = await Promise.all(dogIds.map((id) => firestore.collection('dogs').doc(id).get()))
    const dogs = dogSnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => dogSheetFrom(snapshot.data() ?? {}, today))

    const addressId = typeof session.addressId === 'string' ? session.addressId : ''
    const address = addressId ? (await firestore.collection('addresses').doc(addressId).get()).data() ?? null : null
    const zoneId = typeof address?.zoneId === 'string' ? address.zoneId : ''
    const zoneData = zoneId ? (await firestore.collection('zones').doc(zoneId).get()).data() ?? null : null
    const zone = zoneData
      ? { name: text(zoneData.name) || 'Zona', spots: spotsFrom(zoneData.spots) }
      : null

    return NextResponse.json({ code: 'ok', dogs, zone }, { headers: noStore })
  } catch (error) {
    console.error('walker/walk-sheet failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'walk-sheet-failed' }, { status: 500, headers: noStore })
  }
}
