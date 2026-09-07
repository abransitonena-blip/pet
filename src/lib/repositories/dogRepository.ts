/**
 * DogRepository — wrapper ledger para el modelo legacy `pets` y el nuevo `dogs`.
 *
 * Reads new schema `dogs/{petId}` first, falls back to legacy `pets/{petId}`.
 * Normalized shape: { id, customerId, name, breed? }.
 */

import { doc, getDoc, getFirestore } from 'firebase/firestore'

export type PetData = {
  id: string
  name: string
  ownerId: string
  type?: string
}

export type DogData = {
  id: string
  customerId: string
  name: string
  breed?: string
}

export class DogRepository {
  static async read(petId: string): Promise<DogData | null> {
    const db = getFirestore()

    const newDocRef = doc(db, 'dogs', petId)
    const newSnap = await getDoc(newDocRef)
    if (newSnap.exists()) {
      return newSnap.data() as DogData
    }

    const legacyDocRef = doc(db, 'pets', petId)
    const legacySnap = await getDoc(legacyDocRef)
    if (!legacySnap.exists()) {
      return null
    }
    const legacy = legacySnap.data() as PetData
    return {
      id: legacy.id || petId,
      customerId: legacy.ownerId,
      name: legacy.name,
      breed: (legacy as Record<string, unknown>).breed as string | undefined
    }
  }
}
