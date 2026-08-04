import { termsSections, TERMS_LAST_UPDATED } from '../src/lib/termsContent'
import { isAuthPath } from '../src/lib/consentPaths'

describe('termsContent', () => {
  it('has 8 sections', () => {
    expect(termsSections).toHaveLength(8)
  })

  it('every section has a title and non-empty content', () => {
    for (const s of termsSections) {
      expect(s.title.trim().length).toBeGreaterThan(0)
      expect(s.content.trim().length).toBeGreaterThan(0)
    }
  })

  it('contains no unverified claims (primeros auxilios / IVA)', () => {
    const all = termsSections.map((s) => s.content).join(' ').toLowerCase()
    expect(all).not.toMatch(/primeros auxilios/)
    expect(all).not.toMatch(/incluyen iva/)
    expect(all).not.toMatch(/no compartimos con terceros/)
  })

  it('declares real providers', () => {
    const all = termsSections.map((s) => s.content).join(' ').toLowerCase()
    expect(all).toContain('google')
    expect(all).toContain('firebase')
    expect(all).toContain('vercel')
    expect(all).toContain('whatsapp')
  })

  it('has a valid last-updated date', () => {
    expect(TERMS_LAST_UPDATED).toMatch(/^\d+ de \w+ de \d{4}$/)
  })
})

describe('ConsentProvider isAuthPath', () => {
  it('blocks analytics on auth routes', () => {
    expect(isAuthPath('/login')).toBe(true)
    expect(isAuthPath('/admin')).toBe(true)
    expect(isAuthPath('/admin/reservas')).toBe(true)
    expect(isAuthPath('/paseador')).toBe(true)
    expect(isAuthPath('/familia')).toBe(true)
    expect(isAuthPath('/mi-cuenta/nueva-reserva')).toBe(true)
  })

  it('allows analytics on public routes', () => {
    expect(isAuthPath('/')).toBe(false)
    expect(isAuthPath('/privacidad')).toBe(false)
    expect(isAuthPath('/terminos')).toBe(false)
    expect(isAuthPath('/preguntas-frecuentes')).toBe(false)
  })

  it('does not false-positive on similar prefixes', () => {
    expect(isAuthPath('/login-ayuda')).toBe(false)
    expect(isAuthPath('/administrador')).toBe(false)
  })
})
