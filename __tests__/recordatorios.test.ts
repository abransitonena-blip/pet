import { readFileSync } from 'node:fs'
import { buildReminders, reminderMarker, tomorrowKey, type ReminderSession } from '../src/lib/reminders'

const read = (path: string) => readFileSync(path, 'utf8')

const walk = (over: Partial<ReminderSession> = {}): ReminderSession => ({
  id: 's1', customerId: 'customer-1', walkerId: 'walker-1', status: 'confirmed',
  scheduledDate: '2026-10-02', scheduledStart: '10:00',
  arrivalWindowStart: '10:00', arrivalWindowEnd: '10:20', ...over,
})

describe('a quién se le recuerda el paseo de mañana', () => {
  it('a la familia siempre, y al paseador sólo si ya lo tiene asignado', () => {
    const reminders = buildReminders([walk(), walk({ id: 's2', walkerId: '', status: 'requested' })], '2026-10-02')
    expect(reminders.map((item) => `${item.sessionId}:${item.audience}`))
      .toEqual(['s1:family', 's1:walker', 's2:family'])
  })

  it('un paseo cancelado, terminado o de otro día no se recuerda', () => {
    const sessions = [
      walk({ id: 'cancelado', status: 'cancelled' }),
      walk({ id: 'terminado', status: 'completed' }),
      walk({ id: 'otro-dia', scheduledDate: '2026-10-05' }),
    ]
    expect(buildReminders(sessions, '2026-10-02')).toEqual([])
  })

  it('el aviso dice la hora que la familia va a esperar', () => {
    const [family] = buildReminders([walk()], '2026-10-02')
    expect(family.body).toContain('mañana entre 10:00 y 10:20')
    const [sinVentana] = buildReminders([walk({ arrivalWindowStart: '', arrivalWindowEnd: '' })], '2026-10-02')
    expect(sinVentana.body).toContain('mañana a las 10:00')
  })

  it('cada aviso tiene su marca, distinta por persona, para no repetirse', () => {
    const [family, walker] = buildReminders([walk()], '2026-10-02')
    expect(reminderMarker(family)).toBe('s1_reminder_family')
    expect(reminderMarker(walker)).toBe('s1_reminder_walker')
  })

  it('mañana se calcula en la hora del negocio, no en UTC', () => {
    // 2026-10-01 05:00 UTC son todavía las 23:00 del 30 de septiembre en México:
    // "mañana" es el 1 de octubre, no el 2.
    expect(tomorrowKey(Date.UTC(2026, 9, 1, 5, 0))).toBe('2026-10-01')
    expect(read('src/lib/reminders.ts')).toContain('dateInTimezone(nowMs + 86_400_000, BOOKING_TIMEZONE)')
  })
})

describe('la tarea programada', () => {
  const route = read('src/app/api/cron/reminders/route.ts')

  it('sólo la abre el secreto de la tarea o una sesión de equipo', () => {
    const auth = read('src/lib/cronAuth.ts')
    expect(route).toContain('await authorizeCronCall(request)')
    expect(route).toContain("{ code: 'forbidden' }, { status: 403")
    expect(auth).toContain('const secret = process.env.CRON_SECRET')
    expect(auth).toContain('authorization === `Bearer ${secret}`')
    expect(auth).toContain("caller.role === ROLES.ADMIN || caller.role === ROLES.SUPERVISOR")
  })

  it('una prueba desde el panel cuenta lo que saldría, sin mandar ni marcar nada', () => {
    expect(route).toContain('const dryRun = isDryRun(request)')
    const dryBranch = route.indexOf('if (dryRun) {')
    const firstSend = route.indexOf('notifyUser(')
    const firstMark = route.indexOf('.create(')
    expect(dryBranch).toBeGreaterThan(-1)
    expect(dryBranch).toBeLessThan(firstSend)
    expect(dryBranch).toBeLessThan(firstMark)
    expect(read('src/lib/cronAuth.ts')).toContain("searchParams.get('dryRun') === '1'")
  })

  it('no manda dos veces el mismo recordatorio', () => {
    expect(route).toContain("collection('pushEvents').doc(reminderMarker(reminder)).create(")
    expect(route).toContain('repeated += 1')
  })

  it('lee sólo los paseos de mañana, con tope', () => {
    expect(route).toContain(".where('scheduledDate', '==', tomorrow)")
    expect(route).toContain('.limit(MAX_SESSIONS)')
  })

  it('está programada una vez al día en vercel.json', () => {
    // El horario va en UTC: 01:00 son las 19:00 en la Ciudad de México.
    const vercel = JSON.parse(read('vercel.json')) as { crons?: { path: string; schedule: string }[] }
    expect(vercel.crons).toContainEqual({ path: '/api/cron/reminders', schedule: '0 1 * * *' })
  })
})
