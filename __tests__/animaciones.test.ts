import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')
const css = read('src/app/globals.css')

/**
 * Fase 15. El movimiento explica tres cosas y nada más: que algo llegó, que
 * algo cambió, y que algo está ocurriendo ahora. Todo con CSS, para que no pese
 * en la descarga, y bajo el bloque de "reducir movimiento" que ya existía.
 */
describe('el sistema de animación', () => {
  it('tiene sus tres gestos y sus utilidades', () => {
    for (const keyframe of ['@keyframes pet-enter', '@keyframes pet-pop', '@keyframes pet-live']) {
      expect(css).toContain(keyframe)
    }
    for (const utility of ['.animate-enter ', '.animate-enter-list > *', '.animate-pop', '.animate-live']) {
      expect(css).toContain(utility)
    }
  })

  it('el escalonado se detiene, no crece con la lista', () => {
    expect(css).toContain('.animate-enter-list > *:nth-child(n+6) { animation-delay: 200ms; }')
  })

  it('quien pidió no recibir movimiento no lo recibe', () => {
    // Las dos vías: la preferencia del sistema y la marca que pone Providers.
    const system = css.indexOf('@media (prefers-reduced-motion: reduce)')
    const flag = css.indexOf('[data-reduced-motion="true"] *')
    expect(system).toBeGreaterThan(-1)
    expect(flag).toBeGreaterThan(-1)
    // Y llegan después de las animaciones, para ganarles en la cascada.
    expect(system).toBeGreaterThan(css.indexOf('@keyframes pet-enter'))
    expect(css.slice(system)).toContain('animation-duration: 0.01ms !important')
  })

  it('el botón principal responde al dedo', () => {
    expect(css).toContain('.btn-primary:active:not(:disabled) { transform: scale(0.98); }')
  })
})

describe('dónde se usa', () => {
  it('los paneles entran cuando su código llega', () => {
    for (const file of [
      'src/app/walker/WalkerDashboard.tsx',
      'src/app/familia/FamiliaPanel.tsx',
      'src/app/admin/AdminPanel.tsx',
      'src/app/admin/reservas/AdminReservasPanel.tsx',
    ]) {
      expect({ file, entra: read(file).includes('animate-enter') }).toEqual({ file, entra: true })
    }
  })

  it('un paseo en curso late, y el latido nunca es el único aviso', () => {
    const card = read('src/components/walker/WalkerSessionCard.tsx')
    expect(card).toContain("status === 'in_progress' && <span className=\"animate-live")
    expect(card).toContain('<StatusBadge status={status} />')
    const home = read('src/app/familia/FamiliaPanel.tsx')
    expect(home).toContain('home.live && <span className="animate-live')
    expect(home).toContain("home.live ? 'Tu paseo, ahora' : 'Tu próximo paseo'")
  })

  it('el estado que cambia se vuelve a montar para que su animación se repita', () => {
    expect(read('src/components/walker/WalkerSessionCard.tsx')).toContain('<span key={status} className="animate-pop')
  })

  it('la lista de perros escalona con CSS, sin componente animado por tarjeta', () => {
    const page = read('src/app/familia/perros/FamiliaPerrosPanel.tsx')
    expect(page).toContain('<ul className="animate-enter-list space-y-3">')
    expect(page).not.toContain('<motion.li')
  })
})
