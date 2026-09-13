import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * El encabezado fijo vivía debajo de la portada y se comía todos los clics del
 * menú: `z-sticky` no existía como utilidad de Tailwind, así que quedaba en
 * `z-index: auto` y ganaba el orden del DOM. La clase se ve bien escrita en el
 * código -- por eso nadie lo notó hasta que los enlaces no hicieron nada.
 */
describe('capas de la interfaz', () => {
  test('las clases z-* semánticas existen en Tailwind', () => {
    const config = read('tailwind.config.js')
    expect(config).toContain('zIndex:')
    for (const name of ['dropdown', 'sticky', 'modal', 'toast', 'overlay', 'preloader']) {
      expect(config).toMatch(new RegExp(`'?${name}'?: 'var\\(--z-${name}\\)'`))
    }
  })

  test('cada una apunta a una variable que de verdad está definida', () => {
    const css = read('src/app/globals.css')
    const used = Array.from(read('tailwind.config.js').matchAll(/var\(--z-([a-z-]+)\)/g)).map((m) => m[1])
    expect(used.length).toBeGreaterThan(0)
    for (const name of used) expect(css).toContain(`--z-${name}:`)
  })

  test('el encabezado sigue declarando su capa', () => {
    expect(read('src/components/Header.tsx')).toContain('z-sticky')
  })
})

/**
 * El logo de la pantalla de acceso es un bloque de ancho fijo: `text-center` no
 * lo mueve y `mx-auto` sin ancho tampoco. Quedaba pegado a la izquierda.
 */
describe('pantalla de acceso', () => {
  test('el logo se centra con flex, no con text-center', () => {
    const login = read('src/app/login/page.tsx')
    expect(login).toContain('flex justify-center')
    expect(login).not.toContain('className="mx-auto block mb-4"')
  })
})

/**
 * Los consejos: iconos de trazo en el naranja de la marca, y lo que alguien ya
 * había guardado con emoji se sigue viendo.
 */
describe('consejos para el paseo', () => {
  test('hay un juego corto de iconos y todos existen en lucide', () => {
    const icons = read('src/lib/walkTipIcons.ts')
    expect(icons).toContain("from 'lucide-react'")
    const names = Array.from(icons.matchAll(/name: '([a-z]+)'/g)).map((m) => m[1])
    expect(names.length).toBeGreaterThanOrEqual(8)
    expect(new Set(names).size).toBe(names.length)
  })

  test('los consejos de fábrica usan nombres de icono, no emojis', () => {
    const config = read('src/lib/defaultConfig.ts')
    const block = config.slice(config.indexOf('walkTips: ['), config.indexOf('faq: ['))
    const iconValues = Array.from(block.matchAll(/icon: '([^']+)'/g)).map((m) => m[1])
    expect(iconValues.length).toBeGreaterThanOrEqual(8)
    for (const value of iconValues) {
      expect(read('src/lib/walkTipIcons.ts')).toContain(`name: '${value}'`)
    }
  })

  test('un emoji guardado antes se sigue mostrando en los dos paneles', () => {
    for (const path of ['src/components/WalkTipsSection.tsx', 'src/app/familia/page.tsx']) {
      expect(read(path)).toContain('walkTipIcon(icon)')
    }
    expect(read('src/components/AdminConfig.tsx')).toContain('(el que tenías)')
  })
})

/**
 * Cambiar los consejos de fábrica no cambia los ya guardados en la
 * configuración: ahí seguían sus emojis, así que el sitio seguía dibujando
 * calcomanías aunque el código ya tuviera iconos.
 */
describe('los emojis ya guardados', () => {
  test('se traducen al icono equivalente, sin que nadie edite nada', () => {
    const icons = read('src/lib/walkTipIcons.ts')
    expect(icons).toContain('BY_LEGACY_EMOJI')
    for (const emoji of ['💧', '😴', '🦴']) {
      expect(icons).toContain(`['${emoji}'`)
    }
  })

  test('un emoji desconocido se sigue mostrando tal cual', () => {
    expect(read('src/lib/walkTipIcons.ts')).toContain('return fromEmoji ? BY_NAME.get(fromEmoji) ?? null : null')
  })
})

/** Los precios salieron de la página: varían por zona y no se pueden prometer. */
describe('sin precios en la página pública', () => {
  test('no queda rastro de la sección', () => {
    expect(read('src/app/HomeClient.tsx')).not.toContain('PricingSection')
    expect(read('src/components/Header.tsx')).not.toContain("'/#precios'")
  })
})
