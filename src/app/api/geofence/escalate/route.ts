import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from '@google-cloud/firestore'
import { verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { checkRateLimit } from '@/lib/rateLimit'
import { ROLES } from '@/lib/roles'
import { notifyUser } from '@/lib/push/pushServer'
import { checkFamilyNotice } from '@/lib/familyNotice'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * Avisar a la familia que un paseador salió del área recomendada.
 *
 * La salida se alerta PRIMERO a administración. Este es el segundo paso, y sólo
 * lo da una persona del equipo, con el texto que ella vio y pudo editar: nada
 * de esto ocurre solo. Por eso vive en el servidor y no en el navegador -- el
 * aviso a otra persona (su panel y su teléfono) no se puede escribir desde la
 * pantalla de administración, y un aviso a una familia por un percance es de
 * las cosas que no se mandan dos veces.
 *
 * Una alerta avisa a la familia una sola vez. Si algo más ocurre, se habla con
 * ella por WhatsApp: un segundo aviso con otro texto es una conversación, y una
 * conversación no es un aviso.
 *
 * Sólo administración y supervisión.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const caller = await verifyTokenRole(idToken)
  if (!caller || (caller.role !== ROLES.ADMIN && caller.role !== ROLES.SUPERVISOR)) {
    return NextResponse.json({ code: 'forbidden' }, { status: 403, headers: noStore })
  }

  const rateLimit = checkRateLimit(`geofence-escalate:${caller.uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  let body: { sessionId?: unknown; message?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!sessionId || sessionId.includes('/')) {
    return NextResponse.json({ code: 'invalid-session-id' }, { status: 400, headers: noStore })
  }
  if (checkFamilyNotice(message) !== 'ok') {
    return NextResponse.json({ code: 'invalid-message' }, { status: 400, headers: noStore })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  const alertRef = firestore.collection('geofenceAlerts').doc(sessionId)

  try {
    // Se reserva el aviso antes de mandarlo: dos personas del equipo dándole al
    // botón a la vez no le mandan dos avisos a la misma familia.
    const claim = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(alertRef)
      if (!snapshot.exists) return { kind: 'missing' as const }
      const data = snapshot.data() ?? {}
      if (data.familyNotifiedAt) return { kind: 'already' as const }
      const customerId = typeof data.customerId === 'string' ? data.customerId : ''
      if (!customerId) return { kind: 'no-family' as const }
      transaction.update(alertRef, {
        familyNotifiedAt: Timestamp.now(),
        familyNotifiedBy: caller.uid,
        familyMessage: message,
        resolution: 'incident',
        // Avisar a la familia es haberla atendido: deja de estar abierta.
        ...(data.status === 'open'
          ? { status: 'acknowledged', acknowledgedBy: caller.uid, acknowledgedAt: Timestamp.now() }
          : {}),
      })
      return { kind: 'claimed' as const, customerId }
    })

    if (claim.kind === 'missing') return NextResponse.json({ code: 'alert-not-found' }, { status: 404, headers: noStore })
    if (claim.kind === 'already') return NextResponse.json({ code: 'already-notified' }, { status: 409, headers: noStore })
    if (claim.kind === 'no-family') return NextResponse.json({ code: 'no-family' }, { status: 409, headers: noStore })

    try {
      // Su panel primero: es lo que no depende de que tenga avisos activos.
      await firestore.collection('notifications').doc(claim.customerId).collection('items').add({
        type: 'walk_update',
        title: 'Sobre el paseo de tu perro',
        message,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
      const result = await notifyUser(firestore, claim.customerId, {
        title: 'Sobre el paseo de tu perro',
        body: message,
        url: '/familia',
        tag: `incident-${sessionId}`,
      })
      return NextResponse.json({ code: 'ok', phoneReached: result.sent > 0 }, { headers: noStore })
    } catch (error) {
      // Si no se pudo entregar, se suelta la reserva: el equipo puede volver a intentarlo.
      await alertRef.update({
        familyNotifiedAt: FieldValue.delete(),
        familyNotifiedBy: FieldValue.delete(),
        familyMessage: FieldValue.delete(),
        resolution: FieldValue.delete(),
      }).catch(() => undefined)
      console.error('geofence/escalate delivery failed:', error instanceof Error ? error.message : String(error))
      return NextResponse.json({ code: 'delivery-failed' }, { status: 502, headers: noStore })
    }
  } catch (error) {
    console.error('geofence/escalate failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'escalate-failed' }, { status: 500, headers: noStore })
  }
}
