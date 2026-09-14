import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Lo que se activa con un clic tiene que ser activable con el teclado.
 *
 * Un `<div onClick>` no se alcanza con el tabulador, no responde a Enter, un
 * lector de pantalla lo anuncia como texto, y el piso táctil de 44px no lo cubre
 * -- ése aplica a `button` y a `[role=button]`.
 *
 * Hay tres formas legítimas de que un elemento no interactivo lleve onClick, y
 * esta prueba las reconoce en vez de prohibirlas:
 *
 *  1. El fondo de un modal. Cerrar al tocar fuera es un atajo, nunca la única
 *     salida: esos diálogos tienen su botón de cerrar y responden a Escape.
 *  2. El panel del modal, que sólo frena la propagación para que un clic dentro
 *     no lo cierre. No es un control: no hace nada.
 *  3. Un elemento con rol interactivo declarado (radio, option, tab…), que ya
 *     trae su `tabIndex` y su semántica.
 *
 * Cualquier otro caso es un control disfrazado de texto.
 */

const FONDO = /fixed|absolute inset-0|inset-0|backdrop/
const FRENA_PROPAGACION = /onClick=\{\(\s*e\w*\s*\)\s*=>\s*e\w*\.stopPropagation\(\)\s*\}/
const ROL_INTERACTIVO = /role=["'](button|radio|option|tab|switch|menuitem)/

function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...filesUnder(full))
    else if (full.endsWith('.tsx')) out.push(full)
  }
  return out
}

/** Los atributos de cada `<name ...>`, respetando llaves y comillas. */
function tags(source: string, name: string): { start: number; attrs: string }[] {
  const found: { start: number; attrs: string }[] = []
  const escaped = name.replace('.', '\\.')
  for (const match of Array.from(source.matchAll(new RegExp(`<${escaped}\\b`, 'g')))) {
    let index = match.index + match[0].length
    let depth = 0
    let quote: string | null = null
    while (index < source.length) {
      const char = source[index]
      if (quote) {
        if (char === quote && source[index - 1] !== '\\') quote = null
      } else if (char === '"' || char === "'") quote = char
      else if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      else if (char === '>' && depth === 0) {
        found.push({ start: match.index, attrs: source.slice(match.index + match[0].length, index) })
        break
      }
      index += 1
    }
  }
  return found
}

describe('controles activables', () => {
  test('ningún elemento no interactivo lleva onClick sin una razón conocida', () => {
    const suspicious: string[] = []
    for (const file of filesUnder('src')) {
      const source = readFileSync(file, 'utf8')
      for (const name of ['div', 'motion.div', 'li', 'span']) {
        for (const { start, attrs } of tags(source, name)) {
          if (!attrs.includes('onClick')) continue
          if (ROL_INTERACTIVO.test(attrs) || FRENA_PROPAGACION.test(attrs) || FONDO.test(attrs)) continue
          suspicious.push(`${file}:${source.slice(0, start).split('\n').length}`)
        }
      }
    }
    expect(suspicious).toEqual([])
  })
})
