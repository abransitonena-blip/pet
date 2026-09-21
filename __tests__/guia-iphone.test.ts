import { readFileSync } from 'node:fs'
import { installAdvice, isIos } from '../src/lib/installGuide'

const read = (path: string) => readFileSync(path, 'utf8')

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1'
const IPHONE_FIREFOX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'

/**
 * En iPhone, una pestaña de Safari no puede recibir avisos: sólo la app agregada
 * a la pantalla de inicio. El botón de activar ni aparece, así que la mayoría de
 * los iPhone se quedaban sin avisos sin que nada fallara.
 */
describe('cuándo un teléfono necesita instalarla', () => {
  it('iPhone en Safari: agregarla a la pantalla de inicio', () => {
    expect(installAdvice({ userAgent: IPHONE_SAFARI, standalone: false })).toBe('add-to-home')
  })

  it('iPhone en otro navegador: abrirla primero en Safari', () => {
    expect(installAdvice({ userAgent: IPHONE_CHROME, standalone: false })).toBe('open-in-safari')
    expect(installAdvice({ userAgent: IPHONE_FIREFOX, standalone: false })).toBe('open-in-safari')
  })

  it('el iPad que se presenta como Mac se reconoce por su pantalla táctil', () => {
    expect(isIos({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true)
    expect(installAdvice({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 5, standalone: false })).toBe('add-to-home')
  })

  it('un Mac de verdad no necesita nada', () => {
    expect(isIos({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false)
    expect(installAdvice({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 0, standalone: false })).toBe('none')
  })

  it('Android no necesita nada: el navegador admite avisos tal cual', () => {
    expect(installAdvice({ userAgent: ANDROID_CHROME, standalone: false })).toBe('none')
  })

  it('ya instalada, no hay nada que enseñar', () => {
    expect(installAdvice({ userAgent: IPHONE_SAFARI, standalone: true })).toBe('none')
  })
})

describe('la franja del inicio', () => {
  const nudge = read('src/components/push/PushNudge.tsx')

  it('enseña los tres pasos en Safari', () => {
    expect(nudge).toContain('Agregar a pantalla de inicio')
    expect(nudge).toContain('PET Ap desde el ícono nuevo')
    expect(nudge).toContain('iOS 16.4')
  })

  it('en otro navegador manda a Safari en vez de fingir un camino que no existe', () => {
    expect(nudge).toContain("advice === 'open-in-safari'")
    expect(nudge).toContain('Ábrela en Safari')
  })

  it('tiene prioridad sobre "activar": en una pestaña de iPhone activar no puede funcionar', () => {
    expect(nudge.indexOf("if (advice !== 'none')")).toBeLessThan(nudge.indexOf("availability === 'available' && !wasDismissed(DISMISSED_KEY)"))
  })

  it('no sale si la función está apagada o los avisos ya están activos', () => {
    expect(nudge).toContain("if (availability === 'off' || availability === 'enabled') return")
  })

  it('quien dice "ahora no" no la vuelve a ver, y las dos propuestas se recuerdan por separado', () => {
    expect(nudge).toContain('pet-avisos-instalar-descartada')
    expect(nudge).toContain('pet-avisos-propuesta-descartada')
  })
})
