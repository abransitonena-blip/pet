import { doc, getDoc, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'

const CANONICAL = 'customerProfiles'
const LEGACY = 'clients'

export interface CustomerProfileData {
  name?: string
  phone?: string
  email?: string
}

export async function getCanonicalCustomerProfile(uid: string): Promise<CustomerProfileData | null> {
  const snap = await getDoc(doc(db, CANONICAL, uid))
  return snap.exists() ? snap.data() as CustomerProfileData : null
}

// Canonical store is `customerProfiles`. `clients` is a read-only fallback;
// adapters never migrate or backfill data as a side effect of a read.
export async function getCustomerProfile(uid: string): Promise<CustomerProfileData | null> {
  const canonical = await getCanonicalCustomerProfile(uid)
  if (canonical) return canonical

  const legacy = await getDoc(doc(db, LEGACY, uid))
  if (legacy.exists()) {
    return legacy.data() as CustomerProfileData
  }
  return null
}

export async function ensureCanonicalCustomerProfile(user: { uid: string; displayName?: string | null; email?: string | null }): Promise<'created' | 'existing'> {
  const profileRef = doc(db, CANONICAL, user.uid)
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(profileRef)
    if (existing.exists()) return 'existing'

    transaction.set(profileRef, {
      name: user.displayName || '',
      email: user.email || '',
      phone: '',
      createdAt: serverTimestamp(),
    })
    return 'created'
  })
}

export async function updateCustomerProfile(uid: string, data: CustomerProfileData): Promise<void> {
  await setDoc(doc(db, CANONICAL, uid), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}
