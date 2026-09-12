import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'
import { normalizePostalCode } from '@/lib/zoneMatching'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * "Pregunté por mi colonia": el contador de demanda por código postal.
 *
 * Quien escribía su CP en la página y leía "todavía no llegamos" se iba sin
 * dejar rastro, así que abrir una zona nueva era una corazonada. Cada consulta
 * suma en el documento de ese CP y administración ve cuántas familias la
 * pidieron.
 *
 * Se guarda el código postal y nada más -- ni nombre, ni correo, ni IP. Es un
 * contador por colonia, no una lista de personas. Quien consulta no está
 * identificado (es la página pública), así que el límite de peticiones va por
 * IP: la IP se usa para contar y se descarta, nunca se escribe.
 *
 * El navegador no escribe esta colección: las reglas la dejan cerrada y sólo
 * este servidor la toca. Falla cerrado, y en silencio: si no puede registrar la
 * consulta, la página igual le responde a la familia si la cubrimos o no.
 */
export async function POST(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? ''
  const clientIp = forwarded.split(',')[0]?.trim() || 'sin-ip'
  const rateLimit = checkRateLimit(`coverage-request:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  let body: { postalCode?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  const postalCode = normalizePostalCode(typeof body.postalCode === 'string' ? body.postalCode : '')
  if (!postalCode) {
    return NextResponse.json({ code: 'invalid-postal-code' }, { status: 400, headers: noStore })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  try {
    await firestore.collection('coverageRequests').doc(postalCode).set({
      postalCode,
      count: FieldValue.increment(1),
      lastRequestedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return NextResponse.json({ code: 'ok' }, { headers: noStore })
  } catch (error) {
    console.error('coverage/request failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'coverage-request-failed' }, { status: 500, headers: noStore })
  }
}
