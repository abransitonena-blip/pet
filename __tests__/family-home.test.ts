import { readFileSync } from 'node:fs'
import { hasWalker, planFamilyHome, whenLabel, type HomeWalk } from '../src/lib/familyHome'

const walk = (id: string, status: HomeWalk['status'], date: string, time = '10:00', assignedWalker = '') =>
  ({ id, status, date, time, assignedWalker })

describe('el inicio de la familia: qué va primero', () => {
  it('un paseo que ocurre ahora va antes que uno agendado más temprano', () => {
    const home = planFamilyHome([
      walk('later', 'confirmed', '2026-09-20'),
      walk('now', 'in_progress', '2026-09-15', '09:00', 'walker-1'),
      walk('earlier', 'requested', '2026-09-16'),
    ])
    expect(home.next?.id).toBe('now')
    expect(home.live).toBe(true)
    expect(home.laterCount).toBe(2)
  })

  it('sin nada en curso, el siguiente es el más cercano aunque la lectura venga del más nuevo al más viejo', () => {
    // useCanonicalReservations entrega en orden descendente por fecha.
    const home = planFamilyHome([
      walk('far', 'assigned', '2026-10-01'),
      walk('near-late', 'requested', '2026-09-16', '18:00'),
      walk('near-early', 'confirmed', '2026-09-16', '08:00'),
    ])
    expect(home.next?.id).toBe('near-early')
    expect(home.live).toBe(false)
    expect(home.laterCount).toBe(2)
  })

  it('sin paseos por delante no inventa uno', () => {
    const home = planFamilyHome([walk('done', 'completed', '2026-09-01')])
    expect(home.next).toBeNull()
    expect(home.laterCount).toBe(0)
  })

  it('lo último que pasó: tres, del más reciente al más viejo, con cancelados', () => {
    const home = planFamilyHome([
      walk('a', 'completed', '2026-09-01'),
      walk('b', 'cancelled', '2026-09-10'),
      walk('c', 'completed', '2026-09-12'),
      walk('d', 'no_show', '2026-09-05'),
      walk('e', 'requested', '2026-09-20'),
    ])
    expect(home.recent.map((item) => item.id)).toEqual(['c', 'b', 'd'])
  })
})

describe('a quién escribirle', () => {
  it('sólo cuando hay paseador asignado y el paseo sigue abierto', () => {
    expect(hasWalker(walk('x', 'requested', '2026-09-20'))).toBe(false)
    expect(hasWalker(walk('x', 'assigned', '2026-09-20'))).toBe(false)
    expect(hasWalker(walk('x', 'assigned', '2026-09-20', '10:00', 'walker-1'))).toBe(true)
    expect(hasWalker(walk('x', 'completed', '2026-09-20', '10:00', 'walker-1'))).toBe(false)
  })
})

describe('cuándo', () => {
  it('dice hoy y mañana, también al cruzar de mes', () => {
    expect(whenLabel('2026-09-15', '2026-09-15')).toBe('Hoy')
    expect(whenLabel('2026-09-16', '2026-09-15')).toBe('Mañana')
    expect(whenLabel('2026-10-01', '2026-09-30')).toBe('Mañana')
  })

  it('lo demás, con la fecha corta', () => {
    expect(whenLabel('2026-09-20', '2026-09-15')).toMatch(/20/)
    expect(whenLabel('2026-09-20', '2026-09-15')).not.toBe('Mañana')
  })
})

describe('lo que el inicio ya no carga de entrada', () => {
  const page = readFileSync('src/app/familia/page.tsx', 'utf8')

  it('el formulario de PET Ahora se monta al pedirlo: lee perros y direcciones', () => {
    expect(page).toContain('{petAhoraOpen ? (\n            <PetAhoraRequestForm')
  })

  it('los consejos se abren con un toque y no hay una segunda lista de los mismos paseos', () => {
    expect(page).toContain('aria-expanded={tipsOpen}')
    expect(page).not.toContain('CanonicalFamilyRequests')
    expect(page).not.toContain('Consulta abajo el estado real')
  })
})
