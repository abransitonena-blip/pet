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

/** El texto entre paréntesis balanceados a partir de la posición de `(`. */
function callArgs(source: string, open: number): string {
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1
    else if (source[index] === ')') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, index)
    }
  }
  return ''
}

interface ClientQuery { file: string; collection: string; limit: number | null; spread: boolean }

/**
 * Cada `query(collection(db, 'x'), …)` del cliente, con su límite.
 *
 * Se leen los argumentos completos contando paréntesis, no una ventana de
 * caracteres: con una ventana, veinte consultas sanas aparecían como si no
 * tuvieran límite, que es el mismo error de medir con grep que ya salió antes.
 */
function clientQueries(): ClientQuery[] {
  const found: ClientQuery[] = []
  for (const file of sourceFiles('src')) {
    const source = read(file)
    for (const match of Array.from(source.matchAll(/\bquery\(/g))) {
      const args = callArgs(source, match.index! + match[0].length - 1)
      const collection = args.match(/collection\(db,\s*'(\w+)'\)/)
      if (!collection) continue
      const limitMatch = args.match(/(?:fsLimit|limit)\(\s*([A-Za-z_0-9.]+)\s*\)/)
      let value: number | null = null
      if (limitMatch) {
        const raw = limitMatch[1]
        value = Number(raw)
        if (Number.isNaN(value)) {
          const constant = source.match(new RegExp(`(?:const|let)\\s+${raw}\\s*=\\s*(\\d+)`))
          value = constant ? Number(constant[1]) : null
        }
      }
      found.push({ file, collection: collection[1], limit: value, spread: args.includes('...') })
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

  it('ninguna consulta a una colección con tope se queda sin límite', () => {
    // Sin `limit`, la regla rechaza la consulta entera. Se exceptúan las que
    // arman sus restricciones en un arreglo aparte: ahí el límite existe, pero
    // fuera de la llamada, y se comprueba que el archivo lo ponga.
    const offenders = clientQueries()
      .filter((item) => caps[item.collection] !== undefined && item.limit === null)
      .filter((item) => !(item.spread && /(?:fsLimit|limit)\(/.test(read(item.file))))
      .map((item) => `${item.file}: ${item.collection} sin límite`)
    expect(offenders).toEqual([])
  })

  it('cada consulta del cliente cabe en ese tope', () => {
    // Firestore no recorta: rechaza la consulta entera. Pedir 600 perros con un
    // tope de 100 dejó Perros, Familias e Insights con "no tienes permiso".
    const offenders = clientQueries()
      .filter((item) => caps[item.collection] !== undefined && item.limit !== null && item.limit > caps[item.collection])
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
