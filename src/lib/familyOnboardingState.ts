export interface OnboardingZone {
  id: string
  name: string
  active: boolean
}

export interface FamilyOnboardingSnapshot {
  profile: { name?: string; phone?: string } | null
  addressCount: number
  zonedAddressCount: number
  firstAddressId?: string
  firstAddress?: {
    alias: string
    street: string
    exterior: string
    colony: string
    city: string
    state: string
    zip: string
    zoneId: string
  }
  dogCount: number
}

export type FamilyOnboardingStep = 'profile' | 'zone-address' | 'dog' | 'complete'

export type FamilyOnboardingField =
  | 'name'
  | 'phone'
  | 'zoneId'
  | 'street'
  | 'colony'
  | 'city'
  | 'dogName'
  | 'dogSize'

export interface FamilyOnboardingFormState {
  name: string
  phone: string
  zoneId: string
  street: string
  colony: string
  city: string
  dogName: string
  dogSize: string
}

export interface FamilyOnboardingValidationIssue {
  field: FamilyOnboardingField
  message: string
}

export function normalizeZoneName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-MX')
}

export function getFamilyOnboardingStep(snapshot: FamilyOnboardingSnapshot): FamilyOnboardingStep {
  if (!snapshot.profile?.name?.trim() || !snapshot.profile.phone?.trim()) return 'profile'
  if (snapshot.zonedAddressCount < 1) return 'zone-address'
  if (snapshot.dogCount < 1) return 'dog'
  return 'complete'
}

export function isLaQuebradaSearch(value: string): boolean {
  return normalizeZoneName(value) === 'la quebrada'
}

export function previousFamilyOnboardingStep(step: FamilyOnboardingStep): FamilyOnboardingStep | null {
  if (step === 'dog') return 'zone-address'
  if (step === 'zone-address') return 'profile'
  return null
}

export function validateFamilyOnboardingStep(
  step: FamilyOnboardingStep,
  form: FamilyOnboardingFormState,
): FamilyOnboardingValidationIssue | null {
  if (step === 'profile') {
    if (!form.name.trim()) return { field: 'name', message: 'Escribe tu nombre para continuar.' }
    if (!form.phone.trim()) return { field: 'phone', message: 'Escribe un teléfono de contacto para continuar.' }
  }
  if (step === 'zone-address') {
    if (!form.zoneId) return { field: 'zoneId', message: 'Selecciona una zona con cobertura.' }
    if (!form.street.trim()) return { field: 'street', message: 'Escribe la calle de la dirección.' }
    if (!form.colony.trim()) return { field: 'colony', message: 'Escribe la colonia de la dirección.' }
    if (!form.city.trim()) return { field: 'city', message: 'Escribe la ciudad de la dirección.' }
  }
  if (step === 'dog') {
    if (!form.dogName.trim()) return { field: 'dogName', message: 'Escribe el nombre de tu perro.' }
    if (!form.dogSize) return { field: 'dogSize', message: 'Selecciona el tamaño de tu perro.' }
  }
  return null
}
