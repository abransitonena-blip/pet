import { loadFirestore } from '@/firebase/lazyFirestore'

const CANONICAL = 'customerProfiles'
const LEGACY = 'clients'

export interface CustomerProfileData {
  name?: string
  phone?: string
  email?: string
}

/**
 * Todas estas funciones cargan Firestore al usarse, no al importarse: la
 * pantalla de acceso las importa y se dibuja antes de que alguien entre.
 */
export async function getCanonicalCustomerProfile(uid: string): Promise<CustomerProfileData | null> {
  const { db, doc, getDoc } = await loadFirestore()
  const snap = await getDoc(doc(db, CANONICAL, uid))
  return snap.exists() ? snap.data() as CustomerProfileData : null
}

// Canonical store is `customerProfiles`. `clients` is a read-only fallback;
// adapters never migrate or backfill data as a side effect of a read.
export async function getCustomerProfile(uid: string): Promise<CustomerProfileData | null> {
  const canonical = await getCanonicalCustomerProfile(uid)
  if (canonical) return canonical

  const { db, doc, getDoc } = await loadFirestore()
  const legacy = await getDoc(doc(db, LEGACY, uid))
  if (legacy.exists()) {
    return legacy.data() as CustomerProfileData
  }
  return null
}

export async function ensureCanonicalCustomerProfile(user: { uid: string; displayName?: string | null; email?: string | null }): Promise<'created' | 'existing'> {
  const { db, doc, runTransaction, serverTimestamp } = await loadFirestore()
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
  const { db, doc, setDoc, serverTimestamp } = await loadFirestore()
  await setDoc(doc(db, CANONICAL, uid), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}
