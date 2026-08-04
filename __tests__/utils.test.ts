import { formatDisplayPhone, WHATSAPP_NUMBER } from '../src/lib/utils'
import { DEFAULT_CONFIG } from '../src/lib/defaultConfig'
import { brand } from '../src/lib/brand'

describe('formatDisplayPhone', () => {
  it('formats 12-digit E.164 (5215523053772)', () => {
    expect(formatDisplayPhone('5215523053772')).toBe('+52 55 2305 3772')
  })

  it('formats 12-digit without leading 1 (525523053772)', () => {
    expect(formatDisplayPhone('525523053772')).toBe('+52 55 2305 3772')
  })

  it('strips non-digits', () => {
    expect(formatDisplayPhone('+52 1 55 2305 3772')).toBe('+52 55 2305 3772')
  })

  it('returns input untouched when fewer than 10 digits', () => {
    expect(formatDisplayPhone('552305377')).toBe('552305377')
  })
})

describe('single source of truth for phone', () => {
  it('WHATSAPP_NUMBER matches brand.whatsapp', () => {
    expect(WHATSAPP_NUMBER).toBe(brand.whatsapp)
  })

  it('DEFAULT_CONFIG.whatsapp matches brand.whatsapp', () => {
    expect(DEFAULT_CONFIG.whatsapp).toBe(brand.whatsapp)
  })

  it('DEFAULT_CONFIG.whatsappE164 matches brand.whatsapp', () => {
    expect(DEFAULT_CONFIG.whatsappE164).toBe(brand.whatsapp)
  })

  it('walker phone is a valid 10-digit Mexican number', () => {
    for (const walker of DEFAULT_CONFIG.walkers) {
      expect(walker.phone.replace(/\D/g, '')).toMatch(/^\d{10}$/)
    }
  })

  it('hero content has no legacy "Quebrada" text', () => {
    expect(DEFAULT_CONFIG.heroTitle.toLowerCase()).not.toMatch(/quebrada/)
    expect(DEFAULT_CONFIG.heroSubtitle.toLowerCase()).not.toMatch(/quebrada/)
  })
})
