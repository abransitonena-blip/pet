import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Todo campo de formulario se anuncia con un nombre.
 *
 * Un buscador con lupa y sin etiqueta es "cuadro de texto" para quien usa lector
 * de pantalla; dos campos de fecha seguidos son "cuadro de texto" y "cuadro de
 * texto". WCAG 1.3.1.
 *
 * El recorrido cuenta llaves en vez de usar un regex sobre el tag: un `>` dentro
 * de `onChange={(e) => ...}` cortaba el tag a la mitad y hacía ver como faltantes
 * campos que sí tenían su etiqueta. Con el regex ingenuo salían 91 campos; de
 * verdad eran 15.
 */

// Componentes que reenvían props: su etiqueta la pone quien los usa.
const REENVIAN_PROPS = ['src/components/ui/Input.tsx']

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
  // Array.from: iterar el iterador directo no compila en este target (TS2802).
  for (const match of Array.from(source.matchAll(new RegExp(`<${name}\\b`, 'g')))) {
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

describe('campos de formulario', () => {
  test('todos tienen etiqueta, id o van dentro de un <label>', () => {
    const missing: string[] = []
    for (const file of filesUnder('src')) {
      if (REENVIAN_PROPS.includes(file)) continue
      const source = readFileSync(file, 'utf8')
      for (const name of ['input', 'select', 'textarea']) {
        for (const { start, attrs } of tags(source, name)) {
          if (/type=["']hidden/.test(attrs)) continue
          if (/\b(aria-label|aria-labelledby|id)=/.test(attrs)) continue
          const before = source.slice(Math.max(0, start - 500), start)
          if (before.lastIndexOf('<label') > before.lastIndexOf('</label>')) continue
          missing.push(`${file}:${source.slice(0, start).split('\n').length}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
