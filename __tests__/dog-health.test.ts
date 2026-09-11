import { readFileSync } from 'node:fs'
import { dogAlerts, vaccineStatus } from '@/lib/dogHealth'

const read = (path: string) => readFileSync(path, 'utf8')
const today = '2026-09-10'
const noHealth = { allergies: [], medications: [], vaccines: [], specialNeeds: '' }

describe('salud del perro en admin', () => {
  test('una vacuna solo se marca vencida si la familia anotó la fecha de refuerzo', () => {
    expect(vaccineStatus({ nextDue: '' }, today)).toBe('sin_refuerzo')
    expect(vaccineStatus({ nextDue: '2026-09-09' }, today)).toBe('vencida')
    expect(vaccineStatus({ nextDue: '2026-09-10' }, today)).toBe('por_vencer')
    expect(vaccineStatus({ nextDue: '2026-10-10' }, today)).toBe('por_vencer')
    expect(vaccineStatus({ nextDue: '2026-10-11' }, today)).toBe('vigente')
  })

  test('sin datos de salud no hay alertas', () => {
    expect(dogAlerts(noHealth, today)).toEqual([])
  })

  test('alergias, medicamento, refuerzos y cuidados especiales, en ese orden', () => {
    const alerts = dogAlerts({
      allergies: ['Pollo'],
      medications: ['Antiinflamatorio'],
      vaccines: [
        { name: 'Rabia', date: '2025-09-01', nextDue: '2026-09-01' },
        { name: 'Moquillo', date: '2025-10-01', nextDue: '2026-09-20' },
        { name: 'Parvovirus', date: '2026-01-01', nextDue: '' },
      ],
      specialNeeds: 'Cojea de la pata trasera',
    }, today)
    expect(alerts.map((alert) => alert.key)).toEqual(['alergias', 'medicamento', 'vacuna_vencida', 'vacuna_por_vencer', 'cuidados'])
    expect(alerts.find((alert) => alert.key === 'vacuna_vencida')?.detail).toBe('Rabia')
    expect(alerts.find((alert) => alert.key === 'vacuna_por_vencer')?.detail).toBe('Moquillo')
  })

  test('el directorio de admin lee lo que captura la familia', () => {
    const hook = read('src/lib/useCanonicalDirectory.ts')
    expect(hook).toContain('vaccineList(health.vaccines)')
    expect(hook).toContain('textList(health.allergies)')
    expect(hook).toContain('text(preferences.specialNeeds)')
  })
})

describe('formulario de perros de la familia', () => {
  const form = read('src/app/familia/perros/page.tsx')

  test('se puede anotar la fecha del próximo refuerzo', () => {
    expect(form).toContain("updateVaccine(i, 'nextDue', e.target.value)")
  })

  test('guardar sin elegir sexo no manda undefined a Firestore', () => {
    expect(form).not.toContain('sex: form.sex || undefined')
    expect(form).toContain('sex: form.sex || deleteField()')
    expect(form).toContain('...(form.sex ? { sex: form.sex } : {})')
  })
})
