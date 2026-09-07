import { formatDisplayPhone, normalizeWhatsAppRecipient, WHATSAPP_NUMBER } from '../src/lib/utils'
import { DEFAULT_CONFIG } from '../src/lib/defaultConfig'
import { brand } from '../src/lib/brand'

describe('formatDisplayPhone', () => {
  it('formats the canonical 12-digit E.164 number', () => {
    expect(formatDisplayPhone('525538231235')).toBe('+52 55 3823 1235')
  })

  it('formats a different 12-digit Mexican number', () => {
    expect(formatDisplayPhone('525512345678')).toBe('+52 55 1234 5678')
  })

  it('strips non-digits', () => {
    expect(formatDisplayPhone('+52 55 3823 1235')).toBe('+52 55 3823 1235')
  })

  it('returns input untouched when fewer than 10 digits', () => {
    expect(formatDisplayPhone('553823123')).toBe('553823123')
  })
})

describe('WhatsApp recipients', () => {
  it.each([
    ['5538231235', '525538231235'],
    ['+52 55 3823 1235', '525538231235'],
    ['5215538231235', '525538231235'],
  ])('normalizes %s to a working wa.me recipient', (input, expected) => {
    expect(normalizeWhatsAppRecipient(input)).toBe(expected)
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

  it('uses the owner-approved business contact everywhere by default', () => {
    expect(brand.whatsappRaw).toBe('5538231235')
    expect(brand.whatsapp).toBe('525538231235')
    expect(brand.displayPhone).toBe('+52 55 3823 1235')
    expect(DEFAULT_CONFIG.displayPhone).toBe(brand.displayPhone)
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
