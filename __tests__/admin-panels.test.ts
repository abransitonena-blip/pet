import { readFileSync } from 'node:fs'
import {
  ADMIN_PANELS,
  ALWAYS_VISIBLE_PANEL,
  applyPanelPreferences,
  isPanelVisible,
  movePanel,
  orderedPanels,
  togglePanelId,
} from '@/lib/adminPanels'

const read = (path: string) => readFileSync(path, 'utf8')
const items = ADMIN_PANELS.map((panel) => ({ id: panel.id }))

describe('paneles de administración', () => {
  test('cada panel se explica en una línea, sin dejar ninguno mudo', () => {
    for (const panel of ADMIN_PANELS) {
      expect(panel.description.length).toBeGreaterThan(20)
      expect(panel.label.length).toBeGreaterThan(2)
      expect(panel.group.length).toBeGreaterThan(2)
    }
    // Los ids del menú del layout son los mismos que describe esta lista.
    const layout = read('src/app/admin/AdminLayoutClient.tsx')
    for (const panel of ADMIN_PANELS) {
      expect(layout).toContain(`id: '${panel.id}'`)
    }
  })

  test('ocultar un panel lo saca del menú, y Configuración nunca se puede ocultar', () => {
    expect(isPanelVisible('finanzas', { hidden: ['finanzas'] }, 'admin')).toBe(false)
    expect(isPanelVisible(ALWAYS_VISIBLE_PANEL, { hidden: [ALWAYS_VISIBLE_PANEL] }, 'admin')).toBe(true)
    const visible = applyPanelPreferences(items, { hidden: ['finanzas', 'logs'] }, 'admin').map((item) => item.id)
    expect(visible).not.toContain('finanzas')
    expect(visible).not.toContain('logs')
    expect(visible).toContain('config')
  })

  test('un supervisor puede ver menos que un admin', () => {
    const preferences = { supervisorHidden: ['finanzas'] }
    expect(isPanelVisible('finanzas', preferences, 'admin')).toBe(true)
    expect(isPanelVisible('finanzas', preferences, 'supervisor')).toBe(false)
  })

  test('el orden elegido manda; lo que no se acomodó conserva su lugar al final', () => {
    const ordered = applyPanelPreferences(items, { order: ['ia', 'finanzas'] }, 'admin').map((item) => item.id)
    expect(ordered[0]).toBe('ia')
    expect(ordered[1]).toBe('finanzas')
    // El resto mantiene su orden natural entre sí.
    const rest = ordered.slice(2)
    const natural = ADMIN_PANELS.map((panel) => panel.id).filter((id) => id !== 'ia' && id !== 'finanzas')
    expect(rest).toEqual(natural)
  })

  test('subir y bajar intercambia con el vecino, y en los extremos no hace nada', () => {
    const ids = ADMIN_PANELS.map((panel) => panel.id)
    expect(movePanel(undefined, ids[0], -1)).toEqual(ids)
    expect(movePanel(undefined, ids[ids.length - 1], 1)).toEqual(ids)
    const moved = movePanel(undefined, ids[1], -1)
    expect(moved[0]).toBe(ids[1])
    expect(moved[1]).toBe(ids[0])
  })

  test('sin preferencias, el orden es el natural', () => {
    expect(orderedPanels(undefined).map((panel) => panel.id)).toEqual(ADMIN_PANELS.map((panel) => panel.id))
    expect(togglePanelId(undefined, 'logs')).toEqual(['logs'])
    expect(togglePanelId(['logs'], 'logs')).toEqual([])
  })
})
