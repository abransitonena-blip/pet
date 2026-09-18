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
      'src/app/admin/AdminPanel.tsx',
      'src/app/familia/config/FamiliaConfigPanel.tsx',
      'src/app/familia/direcciones/FamiliaDireccionesPanel.tsx',
      'src/app/admin/chat/AdminChatPanel.tsx',
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

/**
 * El piso táctil de 44×44 (Apple HIG).
 *
 * De 201 botones escritos a mano, 177 no lo garantizaban. Migrarlos uno por uno
 * habría tardado semanas y habría vuelto a romperse al siguiente botón nuevo; el
 * piso va en la hoja de estilos base, donde aplica a todos y cualquier clase de
 * Tailwind lo puede sobreescribir cuando de verdad haga falta.
 */
describe('área táctil', () => {
  const css = read('src/app/globals.css')

  test('hay un piso de 44px para todo lo que se toca', () => {
    const rule = css.slice(css.indexOf("button:not([hidden])"))
    expect(rule.slice(0, 200)).toContain('min-height: 2.75rem')
    expect(rule.slice(0, 200)).toContain('min-width: 2.75rem')
    expect(rule.slice(0, 200)).toContain("[role='button']")
  })

  test('lo oculto queda fuera: no debe empezar a ocupar espacio', () => {
    expect(css).toContain("button:not([hidden])")
  })

  test('el botón compartido ya cumplía, y se queda así', () => {
    const button = read('src/components/ui/Button.tsx')
    expect(button).toContain('min-h-11')
    expect(button).toContain('focus-visible:ring')
    expect(button).toContain('motion-reduce:')
  })
})

/**
 * Movimiento: quien pidió reducirlo debe recibirlo reducido.
 *
 * La regla CSS de globals.css apaga transiciones y animaciones declaradas en
 * hojas de estilo, pero framer-motion anima por JavaScript -- escribe transform
 * en línea, cuadro a cuadro -- y ninguna regla CSS lo detiene. Eran 36 archivos
 * animando para alguien que pidió que no.
 */
describe('reducir movimiento', () => {
  test('framer-motion obedece la preferencia del sistema en toda la app', () => {
    const providers = read('src/components/Providers.tsx')
    expect(providers).toContain('MotionConfig')
    expect(providers).toContain('reducedMotion="user"')
  })

  test('y la regla CSS sigue cubriendo lo declarado en hojas de estilo', () => {
    const css = read('src/app/globals.css')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('animation-duration: 0.01ms !important')
  })
})

/**
 * Lo que se activa es un botón, no un div con onClick.
 *
 * Un `<div onClick>` no se alcanza con el tabulador, no se activa con Enter y un
 * lector de pantalla lo anuncia como texto. Tampoco lo cubre el piso táctil de
 * 44px, que aplica a `button` y a `[role=button]`.
 *
 * El fondo de un modal es la excepción legítima: cerrar al tocar fuera es un
 * atajo, nunca la única salida -- esos diálogos tienen su botón de cerrar y
 * responden a Escape.
 */
describe('controles de verdad', () => {
  test('el inicio de familia actúa con enlaces y botones, y todos traen foco visible', () => {
    // Las tarjetas de cifras eran div con onClick; luego botones; en la fase 9
    // se fueron: el inicio abre con el próximo paseo. Lo que queda son enlaces.
    const page = read('src/app/familia/FamiliaPanel.tsx')
    expect(page).not.toMatch(/<div[^>]*onClick/)
    expect(page).toContain("const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'")
    const controls = page.split(/<(?:Link|button)\b/).slice(1)
    expect(controls.length).toBeGreaterThanOrEqual(5)
    for (const control of controls) {
      // El fin de la etiqueta de apertura: un `>` que no sea parte de `=>`.
      expect(control.slice(0, control.search(/[^=]>/) + 1)).toMatch(/FOCUS_RING|focus-visible:ring/)
    }
  })

  test('una tarjeta que lleva a una función apagada no se ofrece', () => {
    // Decía "Consulta manual" en una fila de cifras, y llevaba a una pantalla
    // que el menú ya escondía.
    const page = read('src/app/familia/FamiliaPanel.tsx')
    if (page.includes('/familia/lealtad')) expect(page).toContain('FEATURE_FLAGS.LOYALTY_REDEMPTION_ENABLED &&')
    expect(page).not.toContain('Consulta manual')
    // Lo mismo para PET Ahora: si está apagado, el inicio no lo ofrece.
    expect(page).toContain('petAhoraAvailable && (')
  })
})
