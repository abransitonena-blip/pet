import { readFileSync } from 'node:fs'
import {
  VACCINE_REMINDER_DAYS, buildVaccineReminders, isRealDate, vaccineReminderMarker, type ReminderDog,
} from '../src/lib/vaccineReminders'

const read = (path: string) => readFileSync(path, 'utf8')
const TODAY = '2026-09-22'

const dog = (id: string, ownerId: string, name: string, dues: (string | undefined)[]): ReminderDog => ({
  id, ownerId, name, vaccines: dues.map((nextDue, index) => ({ name: `Vacuna ${index + 1}`, nextDue })),
})

/**
 * El inicio de la familia ya le recuerda el refuerzo cuando abre la app. Pero un
 * recordatorio que sólo existe si abres la app se pierde justo cuando hace falta.
 */
describe('cuándo se avisa un refuerzo', () => {
  it('una semana antes y el día mismo, y sólo entonces', () => {
    expect(VACCINE_REMINDER_DAYS).toEqual([7, 0])
    const reminders = buildVaccineReminders([
      dog('d7', 'o1', 'Rocco', ['2026-09-29']),
      dog('d0', 'o2', 'Nina', ['2026-09-22']),
      dog('d6', 'o3', 'Luna', ['2026-09-28']),
      dog('d8', 'o4', 'Toby', ['2026-09-30']),
      dog('d30', 'o5', 'Kira', ['2026-10-22']),
    ], TODAY)
    expect(reminders.map((item) => [item.dogId, item.daysLeft])).toEqual([['d7', 7], ['d0', 0]])
  })

  it('un refuerzo ya vencido no se sigue avisando cada noche', () => {
    expect(buildVaccineReminders([dog('d', 'o', 'Rocco', ['2026-09-10', '2026-09-21'])], TODAY)).toEqual([])
  })

  it('sin fecha anotada, no hay aviso: no inventa una vigencia', () => {
    expect(buildVaccineReminders([dog('d', 'o', 'Rocco', ['', undefined])], TODAY)).toEqual([])
    expect(buildVaccineReminders([dog('d', 'o', 'Rocco', [])], TODAY)).toEqual([])
  })

  it('una fecha mal escrita se ignora en vez de romper la corrida', () => {
    expect(buildVaccineReminders([dog('d', 'o', 'Rocco', ['pronto', '2026-13-45', '29/09/2026'])], TODAY)).toEqual([])
  })

  it('una fecha que no existe no se normaliza a otro día para avisarla', () => {
    // 60 de agosto es el 29 de septiembre: justo a siete días de hoy.
    expect(isRealDate('2026-08-60')).toBe(false)
    expect(isRealDate('2026-02-29')).toBe(false)
    expect(isRealDate('2028-02-29')).toBe(true)
    expect(buildVaccineReminders([dog('d', 'o', 'Rocco', ['2026-08-60'])], TODAY)).toEqual([])
  })

  it('dos vacunas para el mismo día son un solo aviso: es la misma visita', () => {
    const reminders = buildVaccineReminders([dog('d', 'o', 'Rocco', ['2026-09-29', '2026-09-29'])], TODAY)
    expect(reminders).toHaveLength(1)
  })

  it('fechas en días distintos que llegan a un umbral, un aviso por día', () => {
    const reminders = buildVaccineReminders([dog('d', 'o', 'Rocco', ['2026-09-22', '2026-09-29'])], TODAY)
    expect(reminders.map((item) => item.daysLeft).sort()).toEqual([0, 7])
  })

  it('cruza el fin de mes y de año', () => {
    expect(buildVaccineReminders([dog('d', 'o', 'Rocco', ['2026-10-05'])], '2026-09-28').map((item) => item.daysLeft)).toEqual([7])
    expect(buildVaccineReminders([dog('d', 'o', 'Rocco', ['2027-01-03'])], '2026-12-27').map((item) => item.daysLeft)).toEqual([7])
  })

  it('un perro sin dueño no tiene a quién avisarle', () => {
    expect(buildVaccineReminders([dog('d', '', 'Rocco', ['2026-09-29'])], TODAY)).toEqual([])
  })
})

describe('lo que dice el aviso', () => {
  const [week] = buildVaccineReminders([dog('d1', 'o1', 'Rocco', ['2026-09-29'])], TODAY)
  const [today] = buildVaccineReminders([dog('d1', 'o1', 'Rocco', ['2026-09-22'])], TODAY)

  it('nombra al perro y dice de quién es la fecha: la que la familia anotó', () => {
    expect(week.body).toContain('Rocco')
    expect(week.body).toContain('según la fecha que anotaste')
    expect(today.body).toContain('Hoy toca')
    expect(week.body).toContain('7 días')
  })

  it('no nombra la vacuna: el aviso sale en la pantalla bloqueada', () => {
    expect(week.body).not.toContain('Vacuna')
    expect(today.body).not.toContain('Vacuna')
  })

  it('lleva a la familia al perfil de su perro, que es donde se corrige la fecha', () => {
    expect(week.url).toBe('/familia/perros/d1')
    expect(week.uid).toBe('o1')
  })

  it('un perro sin nombre no deja un hueco en el texto', () => {
    const [nameless] = buildVaccineReminders([dog('d', 'o', '  ', ['2026-09-29'])], TODAY)
    expect(nameless.body).toContain('tu perro')
  })

  it('el marcador cambia si la familia corrige la fecha: es otro refuerzo', () => {
    const first = vaccineReminderMarker({ dogId: 'd1', dueDate: '2026-09-29', daysLeft: 7 })
    const corrected = vaccineReminderMarker({ dogId: 'd1', dueDate: '2026-10-06', daysLeft: 7 })
    expect(first).not.toBe(corrected)
    // Y los dos avisos del mismo refuerzo no se pisan.
    expect(vaccineReminderMarker({ dogId: 'd1', dueDate: '2026-09-29', daysLeft: 0 })).not.toBe(first)
  })
})

describe('la tarea de las 19:00', () => {
  const route = read('src/app/api/cron/reminders/route.ts')
  const server = read('src/lib/vaccineRemindersServer.ts')
  const card = read('src/components/admin/SystemHealthCard.tsx')

  it('los refuerzos salen en la misma corrida, y una prueba no manda ni marca nada', () => {
    expect(route).toContain('runVaccineReminders(firestore, dateInTimezone(Date.now()), dryRun)')
    expect(server).toContain('if (dryRun) return')
    expect(server.indexOf('if (dryRun) return')).toBeLessThan(server.indexOf('.create({'))
  })

  it('si los refuerzos fallan, los avisos de los paseos ya salieron', () => {
    const vaccines = route.slice(route.indexOf('const vaccines = async'), route.indexOf('if (dryRun) {'))
    expect(vaccines).toContain('} catch (error) {')
    expect(vaccines).toContain('return null')
    // Los paseos se avisan antes de tocar los refuerzos en la respuesta final.
    expect(route.lastIndexOf('for (const reminder of reminders)')).toBeLessThan(route.lastIndexOf('vaccines: await vaccines()'))
  })

  it('no repite: cada aviso deja su marca con create(), que falla si ya existe', () => {
    expect(server).toContain('.doc(vaccineReminderMarker(reminder)).create({')
    expect(server).toContain('repeated += 1')
  })

  it('lee los perros por páginas y con tope, y dice si se alcanzó', () => {
    expect(server).toContain('.limit(PAGE_SIZE)')
    expect(server).toContain('MAX_PAGES')
    expect(server).toContain('capped')
    expect(server).toContain('FieldPath.documentId()')
  })

  it('el panel de estado dice cuántos avisos de refuerzo saldrían, y si no pudo revisarlos', () => {
    expect(card).toContain('aviso(s) de refuerzo')
    expect(card).toContain('No pudimos revisar los refuerzos de vacuna.')
  })

  it('ninguna mención de RFC ni de facturación', () => {
    expect(`${route}${server}`).not.toMatch(/rfc|cfdi|factur/i)
  })
})
