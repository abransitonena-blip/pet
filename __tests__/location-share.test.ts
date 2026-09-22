import {
  SHARE_LINK_MAX_MINUTES,
  SHARE_LINK_MIN_MINUTES,
  clampShareMinutes,
  generateShareToken,
  isShareLinkActive,
  isShareToken,
} from '@/lib/locationShare'

describe('generateShareToken', () => {
  it('genera un token con la forma que valida isShareToken', () => {
    const token = generateShareToken()
    expect(isShareToken(token)).toBe(true)
  })

  it('no repite token entre llamadas', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()))
    expect(tokens.size).toBe(50)
  })
})

describe('isShareToken', () => {
  it('acepta la forma base64url de generateShareToken', () => {
    expect(isShareToken(generateShareToken())).toBe(true)
  })

  it('rechaza lo que no tiene esa forma', () => {
    expect(isShareToken('')).toBe(false)
    expect(isShareToken('corto')).toBe(false)
    expect(isShareToken('con espacios y símbolos!!')).toBe(false)
    expect(isShareToken(123)).toBe(false)
    expect(isShareToken(null)).toBe(false)
    expect(isShareToken(undefined)).toBe(false)
  })
})

describe('clampShareMinutes', () => {
  it('acepta un valor dentro del rango', () => {
    expect(clampShareMinutes(60)).toBe(60)
  })

  it('sube lo que pide menos del mínimo', () => {
    expect(clampShareMinutes(1)).toBe(SHARE_LINK_MIN_MINUTES)
    expect(clampShareMinutes(0)).toBe(SHARE_LINK_MIN_MINUTES)
    expect(clampShareMinutes(-30)).toBe(SHARE_LINK_MIN_MINUTES)
  })

  it('baja lo que pide más del máximo', () => {
    expect(clampShareMinutes(10_000)).toBe(SHARE_LINK_MAX_MINUTES)
  })

  it('redondea valores fraccionarios', () => {
    expect(clampShareMinutes(59.6)).toBe(60)
  })

  it('sin un número válido, el máximo -- nunca un valor inventado', () => {
    expect(clampShareMinutes(undefined)).toBe(SHARE_LINK_MAX_MINUTES)
    expect(clampShareMinutes(Number.NaN)).toBe(SHARE_LINK_MAX_MINUTES)
    expect(clampShareMinutes('60')).toBe(SHARE_LINK_MAX_MINUTES)
  })
})

describe('isShareLinkActive', () => {
  const NOW = 1_700_000_000_000

  it('sin enlace, no está activo', () => {
    expect(isShareLinkActive(null, NOW)).toBe(false)
  })

  it('vigente: no revocado y sin caducar', () => {
    expect(isShareLinkActive({ revokedAtMs: null, expiresAtMs: NOW + 1000 }, NOW)).toBe(true)
  })

  it('caducado, aunque nadie lo haya revocado', () => {
    expect(isShareLinkActive({ revokedAtMs: null, expiresAtMs: NOW - 1000 }, NOW)).toBe(false)
  })

  it('revocado, aunque todavía no caduque', () => {
    expect(isShareLinkActive({ revokedAtMs: NOW - 1000, expiresAtMs: NOW + 1000 }, NOW)).toBe(false)
  })
})
