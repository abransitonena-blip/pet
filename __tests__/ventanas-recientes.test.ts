import { readFileSync } from 'node:fs'
import { daysAgo, monthWindow, WALK_WINDOW_CAP } from '../src/lib/recentWindow'

const read = (path: string) => readFileSync(path, 'utf8')

describe('ventanas de fecha', () => {
  it('cuenta días hacia atrás, también cruzando mes y año', () => {
    expect(daysAgo('2026-09-15', 14)).toBe('2026-09-01')
    expect(daysAgo('2026-09-15', 31)).toBe('2026-08-15')
    expect(daysAgo('2027-01-05', 10)).toBe('2026-12-26')
    expect(daysAgo('2026-09-15', 0)).toBe('2026-09-15')
  })

  it('un mes va del día uno al último, y el desplazamiento retrocede', () => {
    expect(monthWindow('2026-09-15', 0)).toMatchObject({ month: '2026-09', since: '2026-09-01', until: '2026-09-30' })
    expect(monthWindow('2026-09-15', -1)).toMatchObject({ month: '2026-08', since: '2026-08-01', until: '2026-08-31' })
    expect(monthWindow('2026-01-10', -1)).toMatchObject({ month: '2025-12', since: '2025-12-01', until: '2025-12-31' })
    // Febrero de un año bisiesto termina el 29.
    expect(monthWindow('2028-02-10', 0).until).toBe('2028-02-29')
    expect(monthWindow('2026-09-15', 0).label).toMatch(/septiembre/i)
  })
})

describe('las consultas de paseos piden un rango, no "todo"', () => {
  const customerHook = read('src/lib/useCanonicalWalkSessions.ts')
  const walkerHook = read('src/lib/useServiceOrders.ts')

  it('ambas aceptan desde y hasta sobre el mismo índice, y avisan si el rango llegó al tope', () => {
    for (const hook of [customerHook, walkerHook]) {
      expect(hook).toContain("...(since ? [where('scheduledDate', '>=', since)] : [])")
      expect(hook).toContain("...(until ? [where('scheduledDate', '<=', until)] : [])")
      expect(hook).toContain('WALK_WINDOW_CAP')
    }
    expect(customerHook).toContain('setCapped(snapshot.docs.length === WALK_WINDOW_CAP)')
    expect(walkerHook).toContain('setCapped(snap.docs.length === WALK_WINDOW_CAP)')
    expect(WALK_WINDOW_CAP).toBe(100)
  })

  it('ninguna pantalla que muestra lo reciente consulta sin ventana', () => {
    const screens: [string, string][] = [
      ['src/app/familia/mensajes/page.tsx', 'useCustomerWalkSessions'],
      ['src/app/familia/fotos/page.tsx', 'useCustomerWalkSessions'],
      ['src/app/familia/notificaciones/page.tsx', 'useCustomerWalkSessions'],
      ['src/app/familia/perros/[id]/page.tsx', 'useCustomerWalkSessions'],
      ['src/components/family/CanonicalFamilyHistory.tsx', 'useCustomerWalkSessions'],
      ['src/app/walker/page.tsx', 'useWalkerSessions'],
      ['src/app/walker/chat/page.tsx', 'useWalkerSessions'],
      ['src/app/walker/historial/page.tsx', 'useWalkerSessions'],
      ['src/components/walker/WalkerWorkCard.tsx', 'useWalkerSessions'],
    ]
    for (const [file, hook] of screens) {
      const source = read(file)
      // Cada llamada al hook, mirando lo que va después del paréntesis: el
      // primer ')' no sirve de límite porque `daysAgo(...)` trae el suyo.
      const calls = source.split(`${hook}(`).slice(1).map((part) => part.slice(0, 200))
      expect({ file, called: calls.length > 0 }).toEqual({ file, called: true })
      for (const call of calls) expect({ file, call: call.includes('since') }).toEqual({ file, call: true })
    }
  })

  it('los historiales avisan cuando un mes no cupo entero', () => {
    for (const file of ['src/components/family/CanonicalFamilyHistory.tsx', 'src/app/walker/historial/page.tsx']) {
      expect(read(file)).toContain('Los más recientes del mes podrían faltar.')
    }
  })
})
