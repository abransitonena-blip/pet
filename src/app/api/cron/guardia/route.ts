import { NextResponse } from 'next/server'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { staffUidsAmong } from '@/lib/serverAuth'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { notifyUser } from '@/lib/push/pushServer'
import { buildGuardReport, guardMarker, type GuardSession } from '@/lib/guardia'
import { dateInTimezone } from '@/lib/bookingSchedule'
import { authorizeCronCall, isDryRun } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
/** Cuántos paseos se miran hacia atrás y cuántas cuentas con teléfono se revisan. */
const MAX_SESSIONS = 200
const MAX_DEVICE_ACCOUNTS = 100
/** Hasta dónde mirar hacia atrás para encontrar lo que quedó abierto. */
const LOOKBACK_DAYS = 21

/**
 * La guardia de la mañana: lo que no debería quedarse quieto.
 *
 * Un paseo de hoy sin paseador no avisa a nadie hasta que la familia llama.
 * Esta tarea, una vez al día, cuenta eso y lo que quedó abierto de días
 * pasados, y manda UN aviso -- no uno por paseo -- al teléfono de quien opera.
 *
 * Quién es "quien opera": las cuentas con teléfono registrado cuyo rol en los
 * claims sea admin o supervisor. El rol no se lee de una colección: se lee de
 * donde las reglas lo leen.
 *
 * La dispara la tarea programada con su secreto, o una sesión de
 * administración desde el panel -- con `?dryRun=1` para ver qué saldría sin
 * mandar nada. Sin una de las dos llaves, no hace nada. Y si no hay nada que
 * reportar, no manda nada: un aviso diario que casi siempre dice "todo bien" se
 * vuelve ruido y se apaga.
 */
export async function GET(request: Request) {
  const caller = await authorizeCronCall(request)
  if (!caller) return NextResponse.json({ code: 'forbidden' }, { status: 403, headers: noStore })
  const dryRun = isDryRun(request)

  if (!FEATURE_FLAGS.FCM_ENABLED) {
    return NextResponse.json({ code: 'push-not-enabled' }, { status: 503, headers: noStore })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  const today = dateInTimezone(Date.now())
  const [year, month, day] = today.split('-').map(Number)
  const since = new Date(Date.UTC(year, month - 1, day - LOOKBACK_DAYS)).toISOString().slice(0, 10)

  try {
    const snapshot = await firestore
      .collection('walkSessions')
      .where('scheduledDate', '>=', since)
      .where('scheduledDate', '<=', today)
      .limit(MAX_SESSIONS)
      .get()

    const sessions: GuardSession[] = snapshot.docs.map((item) => {
      const data = item.data()
      return {
        id: item.id,
        status: typeof data.status === 'string' ? data.status : '',
        scheduledDate: typeof data.scheduledDate === 'string' ? data.scheduledDate : '',
        walkerId: typeof data.walkerId === 'string' ? data.walkerId : '',
      }
    })

    const report = buildGuardReport(sessions, today)
    if (dryRun) {
      return NextResponse.json({ code: 'ok', dryRun: true, forDate: today, ...report, notified: 0 }, { headers: noStore })
    }
    if (!report.message) {
      return NextResponse.json({ code: 'ok', forDate: today, ...report, notified: 0 }, { headers: noStore })
    }

    // Una vez al día, aunque la tarea corra dos veces.
    try {
      await firestore.collection('pushEvents').doc(guardMarker(today)).create({
        step: 'guardia',
        forDate: today,
        createdAt: new Date().toISOString(),
      })
    } catch {
      return NextResponse.json({ code: 'already-sent', forDate: today, ...report, notified: 0 }, { headers: noStore })
    }

    const devices = await firestore.collection('pushTokens').limit(MAX_DEVICE_ACCOUNTS).get()
    const staff = await staffUidsAmong(devices.docs.map((item) => item.id))

    let notified = 0
    for (const uid of staff) {
      const result = await notifyUser(firestore, uid, {
        title: 'Revisa la operación de hoy',
        body: report.message,
        url: '/admin/reservas',
        tag: 'guardia',
      })
      if (result.sent > 0) notified += 1
    }

    return NextResponse.json({ code: 'ok', forDate: today, ...report, staff: staff.length, notified }, { headers: noStore })
  } catch (error) {
    console.error('cron/guardia failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'guardia-failed' }, { status: 500, headers: noStore })
  }
}
