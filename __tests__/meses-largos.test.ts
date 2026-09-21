import { readFileSync } from 'node:fs'
import { WALK_WINDOW_MAX_PAGES, mergeById } from '../src/lib/walkWindowQueries'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * "Un mes con más de 100 paseos no cabe entero": la pantalla lo decía en lugar
 * de callarlo, pero seguía sin mostrarlos. Ahora el resto del mes se lee en más
 * consultas, y el aviso sólo aparece si ni así cabe.
 */
describe('unir páginas', () => {
  const item = (id: string, value = 0) => ({ id, value })

  it('sin páginas siguientes, es la primera tal cual', () => {
    expect(mergeById([item('a'), item('b')], [])).toEqual([item('a'), item('b')])
  })

  it('no repite un paseo que quedó en las dos: la primera página cambia en vivo', () => {
    const merged = mergeById([item('a'), item('b'), item('c')], [item('c', 9), item('d')])
    expect(merged.map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'd'])
    // Vale la primera lectura, que es la que está en vivo.
    expect(merged.find((entry) => entry.id === 'c')?.value).toBe(0)
  })

  it('no toca lo que recibe', () => {
    const first = [item('a')]
    mergeById(first, [item('b')])
    expect(first).toEqual([item('a')])
  })
})

describe('cuántas páginas', () => {
  it('cinco de cien: quinientos paseos por mes', () => {
    expect(WALK_WINDOW_MAX_PAGES).toBe(5)
  })
})

describe('las pantallas que las usan', () => {
  it('los dos ganchos comparten la consulta con las páginas que siguen', () => {
    expect(read('src/lib/useServiceOrders.ts')).toContain("walkWindowQuery(db, { field: 'walkerId', uid: walkerId }")
    expect(read('src/lib/useCanonicalWalkSessions.ts')).toContain("walkWindowQuery(db, { field: 'customerId', uid: customerId }")
  })

  it('sigue en orden ascendente: los índices de esta colección lo son, y uno que falta deja la pantalla vacía', () => {
    const queries = read('src/lib/walkWindowQueries.ts')
    expect(queries).toContain("orderBy('scheduledDate', 'asc')")
    expect(queries).not.toContain("'desc'")
  })

  it('cada consulta sigue pidiendo el tope de las reglas', () => {
    const queries = read('src/lib/walkWindowQueries.ts')
    expect(queries).toContain('limit(WALK_WINDOW_CAP)')
    expect(read('src/lib/recentWindow.ts')).toContain('export const WALK_WINDOW_CAP = 100')
  })

  it('las páginas que siguen se piden de nuevo si la primera cambia de último documento', () => {
    const hook = read('src/lib/useFollowingPages.ts')
    expect(hook).toContain('anchorId')
    expect(hook).toContain('[db, field, uid, since, until, maxPages, anchorId]')
  })

  it.each([
    ['src/components/family/CanonicalFamilyHistory.tsx', 'useCustomerWalkSessions'],
    ['src/app/walker/historial/WalkerHistorialPanel.tsx', 'useWalkerSessions'],
    ['src/components/walker/WalkerWorkCard.tsx', 'useWalkerSessions'],
  ])('%s pide todas las páginas y espera el resto antes de contar', (path, hook) => {
    const source = read(path)
    expect(source).toContain('maxPages: WALK_WINDOW_MAX_PAGES')
    expect(source).toContain('loadingMore')
    expect(source).toContain(hook)
  })

  it('el aviso ya no dice "más de los que cabe": sólo que no se pudo cargar completo', () => {
    for (const path of ['src/components/family/CanonicalFamilyHistory.tsx', 'src/app/walker/historial/WalkerHistorialPanel.tsx']) {
      const source = read(path)
      expect(source).toContain('Este mes no se pudo cargar completo')
      expect(source).not.toContain('más paseos de los que cabe')
    }
  })

  it('las pantallas de cada día siguen con una sola página: no pagan lo que no necesitan', () => {
    expect(read('src/app/walker/WalkerDashboard.tsx')).not.toContain('maxPages')
    expect(read('src/app/familia/mensajes/FamiliaMensajesPanel.tsx')).not.toContain('maxPages')
  })

  it('"Mi trabajo" ya no se rinde a los cien: sólo pasando de quinientos', () => {
    const card = read('src/components/walker/WalkerWorkCard.tsx')
    expect(card).toContain('más de 500 paseos')
    expect(card).not.toContain('más de 100 paseos')
  })
})
