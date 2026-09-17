import { readFileSync } from 'node:fs'
import { withoutUndefined } from '@/lib/withoutUndefined'

/**
 * Every save in Configuración failed with "Unsupported field value: undefined
 * (found in field termsSections)": the defaults carry optional fields as
 * undefined and each save writes the whole config.
 */
describe('guardado de Configuración', () => {
  test('quita undefined a cualquier profundidad', () => {
    const cleaned = withoutUndefined({
      termsSections: undefined,
      heroTitle: 'PET Ap',
      features: { petAhoraEnabled: true, legacy: undefined },
      faq: [{ q: 'a', note: undefined }, undefined],
    })
    expect(cleaned).toEqual({ heroTitle: 'PET Ap', features: { petAhoraEnabled: true }, faq: [{ q: 'a' }] })
    expect('termsSections' in cleaned).toBe(false)
  })

  test('conserva valores falsos que sí son datos', () => {
    expect(withoutUndefined({ a: null, b: false, c: 0, d: '' })).toEqual({ a: null, b: false, c: 0, d: '' })
  })

  test('no toca instancias como serverTimestamp()', () => {
    class Sentinel { readonly marker = 'server-timestamp' }
    const sentinel = new Sentinel()
    expect(withoutUndefined({ updatedAt: sentinel }).updatedAt).toBe(sentinel)
  })

  test('el contexto limpia la configuración antes de escribirla', () => {
    expect(readFileSync('src/context/ConfigContext.tsx', 'utf8')).toContain('withoutUndefined(next)')
  })
})
