import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'

export type WalkerOperationalStatus = 'active' | 'inactive' | 'suspended'

/**
 * Activar, desactivar o suspender a un paseador ya vinculado.
 *
 * Firestore rules require `walkerProfiles/{uid}.status == 'active'` both to
 * assign a session to a walker and for that walker to advance its state, so
 * this flag is what actually lets the person work. Admin writes to
 * walkerProfiles are already allowed by the rules, so this goes straight from
 * the client -- no privileged server identity involved.
 */
export async function setWalkerStatus(uid: string, status: WalkerOperationalStatus): Promise<void> {
  await updateDoc(doc(db, 'walkerProfiles', uid), { status, updatedAt: serverTimestamp() })
}
