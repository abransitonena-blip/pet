/**
 * CustomerRepository — wrapper ledger para el modelo legacy `clients` y el nuevo `customerProfiles`.
 *
 * Reads new schema `customerProfiles/{uid}` first, falls back to legacy `clients/{uid}`.
 * Normalized shape: { uid, name?, email?, phone? }.
 */

import { doc, getDoc, getFirestore } from 'firebase/firestore'

export type CustomerData = {
  uid: string
  email?: string
  name?: string
  phone?: string
}

export type NewCustomerProfile = {
  userId: string
  name?: string
}

export type LegacyClient = {
  name?: string
  email?: string
  phone?: string
  client?: { firstName?: string; lastName?: string }
}

export class CustomerRepository {
  static async read(uid: string): Promise<CustomerData | null> {
    const db = getFirestore()

    const newDocRef = doc(db, 'customerProfiles', uid)
    const newSnap = await getDoc(newDocRef)
    if (newSnap.exists()) {
      const data = newSnap.data() as NewCustomerProfile
      return { uid, name: data.name } as CustomerData
    }

    const legacyDocRef = doc(db, 'clients', uid)
    const legacySnap = await getDoc(legacyDocRef)
    if (!legacySnap.exists()) {
      return null
    }
    const legacy = legacySnap.data() as LegacyClient
    return {
      uid,
      name: legacy.name,
      email: legacy.email,
      phone: legacy.phone
    }
  }
}
