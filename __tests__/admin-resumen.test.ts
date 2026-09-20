import { readFileSync } from 'node:fs'
import { monthStart, summarizeDay, walksOnTheStreet } from '../src/lib/adminSummary'

const walk = (date: string, status: string) => ({ date, status }) as Parameters<typeof summarizeDay>[0][number]

describe('las cifras del Resumen', () => {
  it('cuenta lo de hoy en marcha y lo completado por separado; lo cancelado no cuenta', () => {
    const day = summarizeDay([
      walk('2026-09-15', 'assigned'),
      walk('2026-09-15', 'in_progress'),
      walk('2026-09-15', 'completed'),
      walk('2026-09-15', 'cancelled'),
      walk('2026-09-14', 'completed'),
    ], '2026-09-15')
    expect(day).toEqual({ today: 2, completedToday: 1, monthToDate: 5 })
  })

  it('el mes empieza el día uno de la fecha local, sin pasar por UTC', () => {
    expect(monthStart('2026-09-15')).toBe('2026-09-01')
    expect(monthStart('2026-12-31')).toBe('2026-12-01')
  })
})

describe('el Resumen abre en lo que pide una decisión', () => {
  const page = readFileSync('src/app/admin/AdminPanel.tsx', 'utf8')

  it('las solicitudes por asignar salen de la misma cola que Solicitudes, no del mes hasta hoy', () => {
    expect(page).toContain('useRequestedWalkSessions()')
    expect(page).toContain('orderDispatchQueue(queue.sessions)')
    expect(page.indexOf('title="Por asignar"')).toBeLessThan(page.indexOf('<dl'))
  })

  it('la fecha de hoy es local', () => {
    expect(page).toContain("new Date().toLocaleDateString('en-CA')")
    expect(page).not.toContain('toISOString()')
  })

  it('no muestra una cifra que siempre es "—", ni lee perfiles para un conteo que no enseña', () => {
    expect(page).not.toContain("label: 'Ingresos del mes'")
    expect(page).not.toContain("collection(db, 'customerProfiles')")
  })

  it('no repite el menú: los accesos rápidos se saltaban los paneles ocultos', () => {
    expect(page).not.toContain('quickActions')
    expect(page).not.toContain("href: '/admin/config'")
  })
})

/**
 * El Resumen decía cuántos paseos había hoy y no cuáles. Para saber quién ya
 * salió y en qué va, había que abrir Solicitudes y paseos y buscarlos entre
 * todos los demás.
 */
describe('los paseos que ya salieron', () => {
  const street = (id: string, date: string, status: string, time = '') =>
    ({ id, date, status, time }) as Parameters<typeof walksOnTheStreet>[0][number] & { id: string }

  it('sólo los de hoy que están en la calle', () => {
    const list = walksOnTheStreet([
      street('a', '2026-09-19', 'assigned'),
      street('b', '2026-09-19', 'in_progress'),
      street('c', '2026-09-18', 'in_progress'),
      street('d', '2026-09-19', 'completed'),
    ], '2026-09-19')
    expect(list.map((walk) => walk.id)).toEqual(['b'])
  })

  it('el que ya está paseando va primero: es el que puede necesitar algo', () => {
    const list = walksOnTheStreet([
      street('a', '2026-09-19', 'on_the_way', '09:00'),
      street('b', '2026-09-19', 'in_progress', '11:00'),
      street('c', '2026-09-19', 'arrived', '10:00'),
    ], '2026-09-19')
    expect(list.map((walk) => walk.id)).toEqual(['b', 'c', 'a'])
  })

  it('a igual estado, manda la hora', () => {
    const list = walksOnTheStreet([
      street('a', '2026-09-19', 'in_progress', '11:00'),
      street('b', '2026-09-19', 'in_progress', '08:30'),
    ], '2026-09-19')
    expect(list.map((walk) => walk.id)).toEqual(['b', 'a'])
  })

  it('el panel los enseña con quién los lleva, sin leer nada de más', () => {
    const page = readFileSync('src/app/admin/AdminPanel.tsx', 'utf8')
    expect(page).toContain('walksOnTheStreet(reservations, today)')
    expect(page).toContain('En la calle ahora')
    expect(page).toContain('{walk.walkerName}')
    // Sale de los paseos que el panel ya tenía: ninguna consulta nueva.
    expect(page.match(/useCanonicalReservations\(/g) ?? []).toHaveLength(1)
  })
})
