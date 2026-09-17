import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase/db'
import { getCanonicalCustomerProfile, updateCustomerProfile } from '@/lib/customerProfile'
import type { FamilyOnboardingSnapshot, OnboardingZone } from '@/lib/familyOnboardingState'

export {
  getFamilyOnboardingStep,
  isLaQuebradaSearch,
  normalizeZoneName,
  previousFamilyOnboardingStep,
  validateFamilyOnboardingStep,
} from '@/lib/familyOnboardingState'
export type {
  FamilyOnboardingSnapshot,
  FamilyOnboardingStep,
  OnboardingZone,
} from '@/lib/familyOnboardingState'

export async function loadFamilyOnboardingSnapshot(uid: string): Promise<FamilyOnboardingSnapshot> {
  const [profile, addresses, dogs] = await Promise.all([
    getCanonicalCustomerProfile(uid),
    getDocs(query(collection(db, 'addresses'), where('ownerId', '==', uid), limit(25))),
    getDocs(query(collection(db, 'dogs'), where('ownerId', '==', uid), limit(50))),
  ])

  const firstAddressDocument = addresses.docs.find((item) => {
    const zoneId = item.data().zoneId
    return typeof zoneId === 'string' && zoneId.trim().length > 0
  }) ?? addresses.docs[0]
  const firstAddress = firstAddressDocument?.data()
  return {
    profile,
    addressCount: addresses.size,
    zonedAddressCount: addresses.docs.filter((item) => {
      const zoneId = item.data().zoneId
      return typeof zoneId === 'string' && zoneId.trim().length > 0
    }).length,
    firstAddressId: firstAddressDocument?.id,
    firstAddress: firstAddress ? {
      alias: String(firstAddress.alias || 'Casa'),
      street: String(firstAddress.street || ''),
      exterior: String(firstAddress.exterior || ''),
      colony: String(firstAddress.colony || ''),
      city: String(firstAddress.city || ''),
      state: String(firstAddress.state || ''),
      zip: String(firstAddress.zip || ''),
      zoneId: String(firstAddress.zoneId || ''),
    } : undefined,
    dogCount: dogs.size,
  }
}

export async function loadActiveZones(): Promise<OnboardingZone[]> {
  const snapshot = await getDocs(query(collection(db, 'zones'), where('active', '==', true), limit(100)))
  return snapshot.docs
    .map((item) => ({ id: item.id, name: String(item.data().name || ''), active: true }))
    .filter((zone) => zone.name.trim().length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))
}

export async function saveOnboardingProfile(uid: string, name: string, phone: string): Promise<void> {
  await updateCustomerProfile(uid, { name: name.trim(), phone: phone.trim() })
}

export async function saveOnboardingAddress(uid: string, input: {
  zoneId: string
  alias: string
  street: string
  exterior: string
  colony: string
  city: string
  state: string
  zip: string
}, existingAddressId?: string): Promise<void> {
  const reference = doc(db, 'addresses', existingAddressId || `onboarding-${uid}`)
  const editable = {
    ownerId: uid,
    alias: input.alias.trim() || 'Casa',
    street: input.street.trim(),
    exterior: input.exterior.trim(),
    colony: input.colony.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    zip: input.zip.trim(),
    zoneId: input.zoneId,
    isDefault: true,
    updatedAt: serverTimestamp(),
  }
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(reference)
    if (current.exists()) transaction.update(reference, editable)
    else transaction.set(reference, { ...editable, createdAt: serverTimestamp() })
  })
}

export async function saveOnboardingDog(uid: string, input: {
  name: string
  breed: string
  size: string
}): Promise<void> {
  const reference = doc(db, 'dogs', `onboarding-${uid}`)
  const editable = {
    ownerId: uid,
    name: input.name.trim(),
    petType: 'perro',
    type: 'perro',
    breed: input.breed.trim(),
    size: input.size,
    updatedAt: serverTimestamp(),
  }
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(reference)
    if (current.exists()) transaction.update(reference, editable)
    else transaction.set(reference, { ...editable, createdAt: serverTimestamp() })
  })
}
