import { readFileSync } from 'node:fs'
import { careReminderLabel, careReminders, type CareDog } from '@/lib/dogCareReminders'

const read = (path: string) => readFileSync(path, 'utf8')
const TODAY = '2026-09-19'

const dog = (id: string, name: string, vaccines: { name: string; nextDue: string }[]): CareDog => ({
  id,
  name,
  breed: 'Mestizo',
  vaccines: vaccines.map((vaccine) => ({ name: vaccine.name, date: '', nextDue: vaccine.nextDue })),
})

/**
 * La familia escribía la fecha del próximo refuerzo en el perfil de su perro y
 * no la volvía a ver nunca: sólo la miraba administración. El dato existía y
 * estaba muerto.
 */
describe('el recordatorio del refuerzo', () => {
  it('no inventa vigencias: sin fecha anotada no hay recordatorio', () => {
    expect(careReminders([dog('d1', 'Rocco', [{ name: 'Rabia', nextDue: '' }])], TODAY)).toEqual([])
  })

  it('calla mientras falte mucho', () => {
    expect(careReminders([dog('d1', 'Rocco', [{ name: 'Rabia', nextDue: '2027-01-01' }])], TODAY)).toEqual([])
  })

  it('avisa lo vencido y lo que viene en los próximos treinta días', () => {
    const reminders = careReminders([
      dog('d1', 'Rocco', [{ name: 'Rabia', nextDue: '2026-10-01' }]),
      dog('d2', 'Nina', [{ name: 'Parvovirus', nextDue: '2026-09-01' }]),
    ], TODAY)
    // Lo vencido va primero: es lo que ya se pasó de fecha.
    expect(reminders.map((item) => item.dogName)).toEqual(['Nina', 'Rocco'])
    expect(reminders[0].urgency).toBe('vencida')
    expect(reminders[1].urgency).toBe('por_vencer')
  })

  it('un perro sale una sola vez, aunque deba dos refuerzos', () => {
    const reminders = careReminders([
      dog('d1', 'Rocco', [
        { name: 'Rabia', nextDue: '2026-09-10' },
        { name: 'Moquillo', nextDue: '2026-09-25' },
      ]),
    ], TODAY)
    expect(reminders).toHaveLength(1)
    // Se nombra lo urgente, no todo lo pendiente: es la misma visita.
    expect(reminders[0].vaccines).toEqual(['Rabia'])
    expect(reminders[0].urgency).toBe('vencida')
  })

  it('dice cuántos días, en palabras que se entienden', () => {
    const [vencida] = careReminders([dog('d1', 'Rocco', [{ name: 'Rabia', nextDue: '2026-09-18' }])], TODAY)
    expect(careReminderLabel(vencida)).toBe('Rabia: el refuerzo venció hace 1 día.')
    const [hoy] = careReminders([dog('d2', 'Nina', [{ name: 'Rabia', nextDue: TODAY }])], TODAY)
    expect(careReminderLabel(hoy)).toBe('Rabia: el refuerzo toca hoy.')
    const [manana] = careReminders([dog('d3', 'Luna', [{ name: 'Rabia', nextDue: '2026-09-20' }])], TODAY)
    expect(careReminderLabel(manana)).toBe('Rabia: el refuerzo toca mañana.')
  })

  it('ordena por fecha entre los que aún no vencen', () => {
    const reminders = careReminders([
      dog('d1', 'Rocco', [{ name: 'Rabia', nextDue: '2026-10-10' }]),
      dog('d2', 'Nina', [{ name: 'Rabia', nextDue: '2026-09-22' }]),
    ], TODAY)
    expect(reminders.map((item) => item.dogName)).toEqual(['Nina', 'Rocco'])
  })
})

describe('el inicio de la familia lo enseña', () => {
  const panel = read('src/app/familia/FamiliaPanel.tsx')

  it('lee los perros de la casa con un tope por debajo del de las reglas', () => {
    const hook = read('src/lib/useFamilyDogs.ts')
    expect(hook).toContain('export const FAMILY_DOGS_LIMIT = 50')
    expect(hook).toContain('limit(FAMILY_DOGS_LIMIT)')
    expect(hook).toContain("where('ownerId', '==', ownerId)")
  })

  it('pone la cara del perro en el próximo paseo y en los últimos', () => {
    expect(panel).toContain('<WalkDogFaces ids={next.dogIds}')
    expect(panel).toContain('<WalkDogFaces ids={res.dogIds}')
  })

  it('lleva al perfil del perro, que es donde se corrige la fecha', () => {
    expect(panel).toContain('href={`/familia/perros/${reminder.dogId}`}')
    expect(panel).toContain('Cuidados de tus perros')
  })

  it('dice de quién es la fecha, sin atribuirse el calendario del veterinario', () => {
    expect(panel).toContain('lo decide su')
    expect(panel).toContain('veterinario')
  })
})
