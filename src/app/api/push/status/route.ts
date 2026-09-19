import { NextResponse } from 'next/server'
import { verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { getPrivilegedIdentityConfig, getPrivilegedAuthClient } from '@/lib/finance/serverIdentity'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { notifyUser } from '@/lib/push/pushServer'
import { ROLES } from '@/lib/roles'
import { describeCloudinaryConfig } from '@/lib/media/cloudinaryAdmin.server'
import { buildHealthChecks } from '@/lib/systemHealth'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
/** Cuántos documentos de dispositivos se cuentan como mucho. */
const DEVICE_SCAN_LIMIT = 200

/**
 * ¿Están los avisos realmente encendidos? Y una prueba que lo demuestre.
 *
 * Los avisos dependen de cuatro cosas que viven en lugares distintos: la
 * bandera del código, la llave VAPID del navegador, la identidad privilegiada
 * del servidor y que alguien haya aceptado recibirlos en su teléfono. Si una
 * falta, no pasa nada visible: ni un error, ni un aviso. Así estuvieron
 * apagados sin que nadie lo notara, porque la llave estaba guardada con otro
 * nombre.
 *
 * GET responde qué hay y qué falta. POST manda un aviso de prueba a los
 * dispositivos de quien lo pide -- nunca a los de otra persona --, que es la
 * única forma de comprobar la cadena entera de punta a punta.
 *
 * Sólo para administración.
 */

function staff(role: string | null): boolean {
  return role === ROLES.ADMIN || role === ROLES.SUPERVISOR
}

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const caller = await verifyTokenRole(idToken)
  if (!caller || !staff(caller.role)) {
    return NextResponse.json({ code: 'forbidden' }, { status: 403, headers: noStore })
  }

  const firestore = getPrivilegedFirestore()
  const identity = Boolean(getPrivilegedIdentityConfig() && getPrivilegedAuthClient())

  let devices = 0
  let people = 0
  if (firestore) {
    const snapshot = await firestore.collection('pushTokens').limit(DEVICE_SCAN_LIMIT).get()
    people = snapshot.size
    devices = snapshot.docs.reduce((total, item) => {
      const tokens = item.data().tokens
      return total + (Array.isArray(tokens) ? tokens.length : 0)
    }, 0)
  }

  const cloudinary = describeCloudinaryConfig()

  return NextResponse.json({
    code: 'ok',
    flagEnabled: FEATURE_FLAGS.FCM_ENABLED,
    serverIdentity: identity,
    firestore: Boolean(firestore),
    people,
    devices,
    // Cada dependencia que vive fuera del código, dicha en una línea. Ningún
    // secreto viaja: sólo si está y qué se apaga cuando no está.
    checks: buildHealthChecks({
      fcmEnabled: FEATURE_FLAGS.FCM_ENABLED,
      vapidKey: Boolean((process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || process.env.NEXT_PUBLIC_FIREBASE_VAPID || '').trim()),
      privilegedIdentity: identity,
      serviceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
      cloudinaryCloud: cloudinary.cloudNameConfigured,
      cloudinaryKey: cloudinary.apiKeyConfigured,
      cloudinarySecret: cloudinary.apiSecretConfigured,
      cronSecret: Boolean(process.env.CRON_SECRET),
      registeredDevices: devices,
    }),
    // Cuántos aparatos tiene registrados quien pregunta: si es cero, el botón
    // de prueba no puede probar nada.
    ownDevices: firestore
      ? ((await firestore.collection('pushTokens').doc(caller.uid).get()).data()?.tokens ?? []).length
      : 0,
  }, { headers: noStore })
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const caller = await verifyTokenRole(idToken)
  if (!caller || !staff(caller.role)) {
    return NextResponse.json({ code: 'forbidden' }, { status: 403, headers: noStore })
  }

  if (!FEATURE_FLAGS.FCM_ENABLED) {
    return NextResponse.json({ code: 'push-not-enabled' }, { status: 503, headers: noStore })
  }

  const rateLimit = checkRateLimit(`push-test:${caller.uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  // El destino es siempre quien pide la prueba. No hay forma de mandarle un
  // aviso a otra persona desde aquí.
  const result = await notifyUser(firestore, caller.uid, {
    title: 'Prueba de avisos de PET Ap',
    body: 'Si ves esto en tu teléfono, los avisos funcionan de punta a punta.',
    url: '/admin',
    tag: 'prueba-avisos',
  })

  return NextResponse.json({ code: 'ok', ...result }, { headers: noStore })
}
