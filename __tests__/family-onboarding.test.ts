import {
  getFamilyOnboardingStep,
  isLaQuebradaSearch,
  normalizeZoneName,
  previousFamilyOnboardingStep,
  validateFamilyOnboardingStep,
} from '@/lib/familyOnboardingState'

const completeForm = {
  name: 'Ana',
  phone: '5551234567',
  zoneId: 'zona-la-quebrada',
  street: 'Calle principal',
  colony: 'La Quebrada',
  city: 'Cuautitlán Izcalli',
  dogName: 'Luna',
  dogSize: 'Mediano',
}

describe('family onboarding', () => {
  it('requires profile, then zoned address, then dog', () => {
    expect(getFamilyOnboardingStep({ profile: null, addressCount: 0, zonedAddressCount: 0, dogCount: 0 })).toBe('profile')
    expect(getFamilyOnboardingStep({ profile: { name: 'Ana', phone: '555' }, addressCount: 1, zonedAddressCount: 0, dogCount: 1 })).toBe('zone-address')
    expect(getFamilyOnboardingStep({ profile: { name: 'Ana', phone: '555' }, addressCount: 1, zonedAddressCount: 1, dogCount: 0 })).toBe('dog')
    expect(getFamilyOnboardingStep({ profile: { name: 'Ana', phone: '555' }, addressCount: 1, zonedAddressCount: 1, dogCount: 1 })).toBe('complete')
  })

  it('normalizes zone names without using partial identity', () => {
    expect(normalizeZoneName('  La Québrada ')).toBe('la quebrada')
    expect(isLaQuebradaSearch('La Quebrada')).toBe(true)
    expect(isLaQuebradaSearch('Quebrada')).toBe(false)
  })

  it('returns to the previous persisted step without skipping profile data', () => {
    expect(previousFamilyOnboardingStep('dog')).toBe('zone-address')
    expect(previousFamilyOnboardingStep('zone-address')).toBe('profile')
    expect(previousFamilyOnboardingStep('profile')).toBeNull()
  })

  it.each([
    ['profile', { name: '' }, 'name'],
    ['profile', { phone: '' }, 'phone'],
    ['zone-address', { zoneId: '' }, 'zoneId'],
    ['zone-address', { street: '' }, 'street'],
    ['zone-address', { colony: '' }, 'colony'],
    ['zone-address', { city: '' }, 'city'],
    ['dog', { dogName: '' }, 'dogName'],
    ['dog', { dogSize: '' }, 'dogSize'],
  ] as const)('identifies the exact missing field for %s', (step, change, field) => {
    expect(validateFamilyOnboardingStep(step, { ...completeForm, ...change })).toMatchObject({ field })
  })

  it('accepts each complete onboarding step without inventing data', () => {
    expect(validateFamilyOnboardingStep('profile', completeForm)).toBeNull()
    expect(validateFamilyOnboardingStep('zone-address', completeForm)).toBeNull()
    expect(validateFamilyOnboardingStep('dog', completeForm)).toBeNull()
  })
})
