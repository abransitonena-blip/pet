import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(path, 'utf8')

function filesUnder(dir: string, match: RegExp): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...filesUnder(full, match))
    else if (match.test(entry)) out.push(full)
  }
  return out
}

/**
 * El piso de accesibilidad de PET Ap, escrito en AGENTS.md y fijado aquí.
 *
 * Nace de lo medido el 2026-09-14: 151 usos de texto de 10px, y ninguna pantalla
 * del panel con un h1 porque el encabezado compartido dibujaba un h2. Ninguna
 * herramienta lo marcó: el contraste siempre estuvo bien, y un texto con
 * contraste perfecto sigue siendo ilegible a 10px.
 */
describe('escala tipográfica', () => {
  const config = read('tailwind.config.js')

  test('el piso es 12px: ninguna clase de la escala baja de ahí', () => {
    const sizes = Array.from(config.matchAll(/'?(2xs|xs|sm)'?: \['([\d.]+)rem'/g))
    expect(sizes.length).toBe(3)
    for (const [, name, rem] of sizes) {
      expect({ name, px: Number(rem) * 16 }).toMatchObject({ name, px: expect.any(Number) })
      expect(Number(rem) * 16).toBeGreaterThanOrEqual(12)
    }
  })

  test('la escala sube: 2xs < xs < sm', () => {
    // El nombre se ancla al inicio de línea: '2xs' contiene 'xs', y sin anclar
    // la prueba se comparaba contra sí misma y pasaba por accidente.
    const value = (name: string) => {
      const found = new RegExp(`^\\s*'?${name}'?: \\['([\\d.]+)rem'`, 'm').exec(config)
      return found ? Number(found[1]) : 0
    }
    expect(value('2xs')).toBeGreaterThan(0)
    expect(value('2xs')).toBeLessThan(value('xs'))
    expect(value('xs')).toBeLessThan(value('sm'))
  })

  test('nadie escribe tamaños crudos por debajo del piso', () => {
    // El recibo es la única excepción: representa papel de 58 mm, no pantalla.
    const RECIBO = /Ticket|Printing|Receipt/
    const offenders = filesUnder('src', /\.tsx$/)
      .filter((file) => !RECIBO.test(file))
      .filter((file) => /text-\[(?:[0-9]|1[01])px\]/.test(read(file)))
    expect(offenders).toEqual([])
  })

  test('la excepción del recibo está dicha, no escondida', () => {
    expect(read('src/components/tickets/TicketReceiptView.tsx')).toContain('excepción a la escala tipográfica')
  })
})

describe('encabezados', () => {
  test('el encabezado compartido es el h1 de su pantalla', () => {
    const header = read('src/components/ui/PageHeader.tsx')
    expect(header).toContain('<h1')
    expect(header).not.toContain('<h2')
  })

  test('las pantallas que no lo usan traen el suyo', () => {
    for (const page of [
      'src/app/admin/page.tsx',
      'src/app/familia/config/page.tsx',
      'src/app/familia/direcciones/page.tsx',
      'src/app/admin/chat/page.tsx',
    ]) {
      const source = read(page)
      expect(source.includes('<h1') || source.includes('PageHeader')).toBe(true)
    }
  })
})

describe('las reglas están escritas', () => {
  test('AGENTS.md abre con reglas, no con historia', () => {
    const agents = read('AGENTS.md')
    expect(agents.slice(0, 200)).toContain('Reglas de trabajo')
    for (const rule of ['44×44', 'prefers-reduced-motion', 'REQUIERE DESPLEGAR REGLAS', 'emulador']) {
      expect(agents).toContain(rule)
    }
  })
})
