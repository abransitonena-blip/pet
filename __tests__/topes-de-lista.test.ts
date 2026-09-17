import { readFileSync, readdirSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** El tope que cada colección impone a sus listas, leído de las reglas. */
function ruleCaps(): Record<string, number> {
  const rules = read('firestore.rules')
  const caps: Record<string, number> = {}
  for (const match of Array.from(rules.matchAll(/match \/(\w+)\/\{[^}]*\}\s*\{/g))) {
    const collection = match[1]
    let block = rules.slice(match.index! + match[0].length, match.index! + match[0].length + 4000)
    const nextMatch = block.indexOf('\n    match /')
    if (nextMatch > 0) block = block.slice(0, nextMatch)
    const limit = block.match(/validListLimit\((\d+)\)/)
    if (limit) caps[collection] = Number(limit[1])
  }
  return caps
}

/** Cada `collection(db, 'x')` del cliente con el `limit(...)` que lo acompaña. */
function clientQueries(): { file: string; collection: string; limit: number }[] {
  const found: { file: string; collection: string; limit: number }[] = []
  for (const file of sourceFiles('src')) {
    const source = read(file)
    for (const match of Array.from(source.matchAll(/collection\(db,\s*'(\w+)'\)([\s\S]{0,400})/g))) {
      const [, collection, tail] = match
      const limitMatch = tail.match(/(?:fsLimit|limit)\(\s*([A-Za-z_0-9.]+)\s*\)/)
      if (!limitMatch) continue
      const raw = limitMatch[1]
      let value = Number(raw)
      if (Number.isNaN(value)) {
        const constant = source.match(new RegExp(`(?:const|let)\\s+${raw}\\s*=\\s*(\\d+)`))
        if (!constant) continue
        value = Number(constant[1])
      }
      found.push({ file, collection, limit: value })
    }
  }
  return found
}

describe('ninguna consulta pide más de lo que la regla permite listar', () => {
  const caps = ruleCaps()

  it('las reglas siguen imponiendo un tope a las colecciones grandes', () => {
    expect(caps.dogs).toBe(100)
    expect(caps.walkSessions).toBe(100)
    expect(caps.walkReports).toBe(100)
  })

  it('cada consulta del cliente cabe en ese tope', () => {
    // Firestore no recorta: rechaza la consulta entera. Pedir 600 perros con un
    // tope de 100 dejó Perros, Familias e Insights con "no tienes permiso".
    const offenders = clientQueries()
      .filter((item) => caps[item.collection] !== undefined && item.limit > caps[item.collection])
      .map((item) => `${item.file}: ${item.collection} pide ${item.limit}, tope ${caps[item.collection]}`)
    expect(offenders).toEqual([])
  })

  it('el directorio de admin lee los perros de cien en cien', () => {
    const directory = read('src/lib/useCanonicalDirectory.ts')
    expect(directory).toContain('const DOGS_PAGE = 100')
    expect(directory).toContain('startAfter(cursor)')
    expect(directory).not.toContain('fsLimit(MAX_DOGS)')
  })
})
