import { readFileSync } from 'node:fs'
import { monthStart, summarizeDay } from '../src/lib/adminSummary'

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
