import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'

export async function logChange(
  action: string,
  reservationId: string,
  details: Record<string, any>,
  userId?: string
) {
  try {
    await addDoc(collection(db, 'audit-logs'), {
      action,
      reservationId,
      details,
      userId: userId || 'unknown',
      timestamp: serverTimestamp(),
    })
  } catch {}
}
