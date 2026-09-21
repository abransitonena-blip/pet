import { NextResponse } from 'next/server'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { notifyUser } from '@/lib/push/pushServer'
import { buildReminders, reminderMarker, tomorrowKey, type ReminderSession } from '@/lib/reminders'
import { authorizeCronCall, isDryRun } from '@/lib/cronAuth'
import { runVaccineReminders, type VaccineRunResult } from '@/lib/vaccineRemindersServer'
import { dateInTimezone } from '@/lib/bookingSchedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
/** Cuántos paseos de mañana se leen como mucho. */
const MAX_SESSIONS = 200

/**
 * El recordatorio de la tarde anterior.
 *
 * Lo llama la tarea programada de Vercel una vez al día (ver vercel.json), con
 * el secreto en la cabecera. El horario de esa tarea va en UTC: `0 1 * * *` son
 * las siete de la tarde en la Ciudad de México, la víspera del paseo.
 *
 * La otra llave es una sesión de administración, para poder probarla hoy sin
 * esperar a la tarde; con `?dryRun=1` cuenta lo que saldría sin mandar nada.
 * Sin una de las dos, la ruta no hace nada: un recordatorio que cualquiera
 * puede disparar es una forma de molestar a las familias a las tres de la
 * mañana.
 *
 * No inventa a quién avisar: lee los paseos de mañana y manda un aviso por
 * familia y, si ya tiene paseador, otro al paseador. Cada aviso deja su marca
 * en `pushEvents` con create(), que falla si ya existe, así que una segunda
 * corrida del mismo día no vuelve a avisar.
 *
 * En la misma corrida sale también el aviso de refuerzo de vacuna, a quien anotó
 * la fecha: una semana antes y el día mismo (ver `vaccineReminders.ts`). Va aparte
 * de lo anterior: si falla, los recordatorios de paseo ya salieron.
 */
export async function GET(request: Request) {
  const caller = await authorizeCronCall(request)
  if (!caller) return NextResponse.json({ code: 'forbidden' }, { status: 403, headers: noStore })
  // Una prueba desde el panel cuenta lo que saldría, sin mandar ni marcar nada.
  const dryRun = isDryRun(request)

  if (!FEATURE_FLAGS.FCM_ENABLED) {
    return NextResponse.json({ code: 'push-not-enabled' }, { status: 503, headers: noStore })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  const tomorrow = tomorrowKey(Date.now())

  try {
    const snapshot = await firestore
      .collection('walkSessions')
      .where('scheduledDate', '==', tomorrow)
      .limit(MAX_SESSIONS)
      .get()

    const sessions: ReminderSession[] = snapshot.docs.map((item) => {
      const data = item.data()
      return {
        id: item.id,
        customerId: typeof data.customerId === 'string' ? data.customerId : '',
        walkerId: typeof data.walkerId === 'string' ? data.walkerId : '',
        status: typeof data.status === 'string' ? data.status : '',
        scheduledDate: typeof data.scheduledDate === 'string' ? data.scheduledDate : '',
        scheduledStart: typeof data.scheduledStart === 'string' ? data.scheduledStart : '',
        arrivalWindowStart: typeof data.arrivalWindowStart === 'string' ? data.arrivalWindowStart : '',
        arrivalWindowEnd: typeof data.arrivalWindowEnd === 'string' ? data.arrivalWindowEnd : '',
      }
    })

    const reminders = buildReminders(sessions, tomorrow)
    let sent = 0
    let repeated = 0

    // Los refuerzos de vacuna van en la misma tarea, pero aparte: si su lectura
    // falla, los avisos de los paseos de mañana ya no dependen de ella.
    const vaccines = async (): Promise<VaccineRunResult | null> => {
      try {
        return await runVaccineReminders(firestore, dateInTimezone(Date.now()), dryRun)
      } catch (error) {
        console.error('cron/reminders vaccines failed:', error instanceof Error ? error.message : String(error))
        return null
      }
    }

    if (dryRun) {
      return NextResponse.json({
        code: 'ok', dryRun: true, forDate: tomorrow, walks: sessions.length, reminders: reminders.length, sent: 0, repeated: 0,
        vaccines: await vaccines(),
      }, { headers: noStore })
    }

    for (const reminder of reminders) {
      try {
        await firestore.collection('pushEvents').doc(reminderMarker(reminder)).create({
          sessionId: reminder.sessionId,
          step: 'reminder',
          audience: reminder.audience,
          createdAt: new Date().toISOString(),
        })
      } catch {
        // Ya se había mandado: la marca existe.
        repeated += 1
        continue
      }
      const result = await notifyUser(firestore, reminder.uid, {
        title: reminder.title,
        body: reminder.body,
        url: reminder.url,
        tag: `reminder-${reminder.sessionId}`,
      })
      sent += result.sent
    }

    return NextResponse.json({
      code: 'ok',
      calledBy: caller,
      forDate: tomorrow,
      walks: sessions.length,
      reminders: reminders.length,
      sent,
      repeated,
      vaccines: await vaccines(),
    }, { headers: noStore })
  } catch (error) {
    console.error('cron/reminders failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'reminders-failed' }, { status: 500, headers: noStore })
  }
}
