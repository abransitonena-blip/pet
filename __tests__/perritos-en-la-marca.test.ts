import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(path, 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (full.endsWith('.tsx')) out.push(full)
  }
  return out
}

/**
 * La app se veía neutra: barras grises al cargar y cuadros grises donde no hay
 * nada. Nada decía que esto es de perros. Lo que se mueve y lo que espera son
 * las dos pantallas que todo el mundo ve, así que ahí va la marca.
 */
describe('la espera tiene huellas', () => {
  const trail = read('src/components/ui/PawTrail.tsx')

  it('es decorativa: quien usa lector de pantalla oye el texto, no el dibujo', () => {
    expect(trail).toContain('aria-hidden="true"')
    expect(read('src/components/ui/LoadingState.tsx')).toContain('<span className="sr-only">{message}</span>')
  })

  it('anima con CSS, que el bloque de reducir movimiento ya apaga', () => {
    expect(trail).not.toContain('framer-motion')
    const css = read('src/app/globals.css')
    expect(css).toContain('.paw-trail > *')
    expect(css).toContain('@keyframes paw-step')
    // La regla global de prefers-reduced-motion cubre cualquier animación.
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('acompaña a cada pantalla que dice "cargando"', () => {
    expect(read('src/components/ui/LoadingState.tsx')).toContain('<PawTrail')
  })
})

describe('ningún hueco vacío se queda sin ícono', () => {
  it('cada EmptyState dice con un dibujo de qué está hablando', () => {
    const missing: string[] = []
    for (const file of walk('src')) {
      const source = read(file)
      let index = source.indexOf('<EmptyState')
      while (index !== -1) {
        let depth = 0
        let cursor = index
        while (cursor < source.length) {
          const char = source[cursor]
          if (char === '{') depth += 1
          else if (char === '}') depth -= 1
          else if (char === '>' && depth === 0) { cursor += 1; break }
          cursor += 1
        }
        if (!source.slice(index, cursor).includes('icon=')) missing.push(`${file}:${source.slice(0, index).split('\n').length}`)
        index = source.indexOf('<EmptyState', cursor)
      }
    }
    expect(missing).toEqual([])
  })

  it('el cuadro del ícono lleva el color de la casa, no gris sobre gris', () => {
    const empty = read('src/components/ui/EmptyState.tsx')
    expect(empty).toContain('bg-primary/10 text-primary')
    expect(empty).not.toContain('bg-ink/5')
  })
})
