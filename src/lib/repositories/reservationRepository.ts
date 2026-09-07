/**
 * ReservationRepository — wrapper ledger para el modelo de reservas.
 *
 * Reads from the existing `reservations/{id}` collection.
 * Normalized shape: { id, customerId, dogIds, status }.
 */

import { doc, getDoc, getFirestore } from 'firebase/firestore'

export type ReservationData = {
  id: string
  customerId: string
  dogIds: string[]
  status: string
}

export class ReservationRepository {
  static async read(resId: string): Promise<ReservationData | null> {
    const db = getFirestore()
    const docRef = doc(db, 'reservations', resId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) {
      return null
    }
    const data = snap.data() as Record<string, unknown>
    const customer = data.customer as Record<string, unknown> | undefined
    const client = data.client as Record<string, unknown> | undefined
    return {
      id: resId,
      customerId: (data.customerId || customer?.uid || client?.uid) as string,
      dogIds: (data.dogIds || (data.dogs as string[]) || []) as string[],
      status: (data.status || 'pending') as string
    }
  }
}
