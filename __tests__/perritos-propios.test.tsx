/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import DogIllustration, { DOG_POSES } from '../src/components/ui/DogIllustration'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * Los huecos vacíos eran un cuadro con un ícono de trazo, igual al de cualquier
 * app. Cada uno tiene ahora un perro haciendo algo que tiene que ver con lo que
 * falta.
 */
describe('los dibujos', () => {
  it('hay cinco posturas, y cada una se dibuja', () => {
    expect([...DOG_POSES].sort()).toEqual(['asomando', 'caminando', 'durmiendo', 'olfateando', 'sentado'])
    for (const pose of DOG_POSES) {
      const svg = renderToStaticMarkup(<DogIllustration pose={pose} />)
      expect(svg).toContain('<svg')
      expect(svg).toContain('viewBox=')
    }
  })

  it('son decorativos: el título de al lado es el que informa', () => {
    for (const pose of DOG_POSES) {
      const svg = renderToStaticMarkup(<DogIllustration pose={pose} />)
      expect(svg).toContain('aria-hidden="true"')
      expect(svg).toContain('focusable="false"')
      expect(svg).not.toContain('<title')
    }
  })

  it('el perro es del color de marca que elige el negocio, no uno fijo', () => {
    for (const pose of DOG_POSES) {
      const svg = renderToStaticMarkup(<DogIllustration pose={pose} />)
      expect(svg).toContain('currentColor')
      expect(svg).toContain('text-primary')
    }
    // Ningún naranja de marca escrito a mano: cambiar el color en Diseño y marca los cambia.
    expect(read('src/components/ui/DogIllustration.tsx')).not.toMatch(/#(C45100|E2650B|E67E22|D35400)/i)
  })

  it('las patas y el hocico no usan el color de la tarjeta: desaparecían sobre ella', () => {
    const source = read('src/components/ui/DogIllustration.tsx')
    // El color de la tarjeta es justo el del fondo donde va el dibujo.
    expect(source).not.toContain("CREAM = 'var(--bg-surface)'")
    expect(source).toContain("const CREAM = '#FBEBD9'")
  })

  it('ojos y nariz son oscuros en cualquier tema: sobre el naranja una nariz blanca no es una nariz', () => {
    const source = read('src/components/ui/DogIllustration.tsx')
    expect(source).toContain("const FEATURE = '#172033'")
    // Lo que sí sigue al tema es lo que va sobre la página: zetas, correa, lupa, el borde.
    expect(source).toContain("const INK = 'var(--text-primary)'")
  })
})

describe('los huecos vacíos', () => {
  it('EmptyState acepta un perrito y lo prefiere al ícono, que queda de respaldo', () => {
    const empty = read('src/components/ui/EmptyState.tsx')
    expect(empty).toContain('illustration?: DogPose')
    expect(empty).toContain('{illustration ? (')
    expect(empty).toContain('<DogIllustration pose={illustration}')
  })

  const CHOSEN: [string, string][] = [
    ['src/app/familia/FamiliaPanel.tsx', 'sentado'],
    ['src/app/familia/FamilyLayoutClient.tsx', 'sentado'],
    ['src/app/familia/mensajes/FamiliaMensajesPanel.tsx', 'asomando'],
    ['src/app/familia/perros/FamiliaPerrosPanel.tsx', 'sentado'],
    ['src/app/familia/direcciones/FamiliaDireccionesPanel.tsx', 'caminando'],
    ['src/app/familia/notificaciones/FamiliaNotificacionesPanel.tsx', 'durmiendo'],
    ['src/app/familia/historial/FamiliaHistorialPanel.tsx', 'durmiendo'],
    ['src/app/walker/WalkerDashboard.tsx', 'durmiendo'],
    ['src/app/admin/AdminPanel.tsx', 'sentado'],
    ['src/app/admin/reportes/AdminReportesPanel.tsx', 'olfateando'],
  ]

  it.each(CHOSEN)('%s enseña un perro %s', (path, pose) => {
    expect(read(path)).toContain(`<EmptyState illustration="${pose}"`)
  })

  it('cada dibujo dice algo: el que espera, el que duerme, el que se asoma, el que busca', () => {
    // Nada pendiente -> duerme. Nada que mostrar todavía -> espera sentado.
    expect(read('src/app/walker/WalkerDashboard.tsx')).toContain('<EmptyState illustration="durmiendo"')
    expect(read('src/app/familia/FamiliaPanel.tsx')).toContain('<EmptyState illustration="sentado"')
    // Nadie con quién hablar -> se asoma. Una búsqueda sin resultado -> olfatea.
    expect(read('src/app/familia/mensajes/FamiliaMensajesPanel.tsx')).toContain('<EmptyState illustration="asomando"')
    expect(read('src/app/admin/reportes/AdminReportesPanel.tsx')).toContain('<EmptyState illustration="olfateando"')
  })

  it('el ícono sigue en cada uno: es el respaldo, y la prueba de íconos lo exige', () => {
    for (const [path] of CHOSEN) {
      expect(read(path)).toMatch(/<EmptyState illustration="[a-z]+"[\s\S]{0,80}icon=/)
    }
  })
})
