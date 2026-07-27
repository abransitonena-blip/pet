import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'

export type AuditAction = 'create' | 'update' | 'delete' | 'assign' | 'cancel' | 'complete'
export type AuditEntity = 'reservation' | 'serviceOrder' | 'walkSession' | 'coupon' | 'client' | 'walker'

interface AuditLogParams {
  action: AuditAction
  entity: AuditEntity
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export async function logAudit({ action, entity, entityId, before, after, meta }: AuditLogParams): Promise<void> {
  try {
    await addDoc(collection(db, 'audit-logs'), {
      actor: {
        uid: typeof window !== 'undefined' ? (await import('firebase/auth')).getAuth().currentUser?.uid || 'system' : 'system',
      },
      action,
      entity,
      entityId,
      before: before ? sanitize(before) : null,
      after: after ? sanitize(after) : null,
      meta: meta ? sanitize(meta) : null,
      timestamp: serverTimestamp(),
    })
  } catch {
    console.warn('[audit] Failed to write audit log')
  }
}

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  const skipKeys = ['notes', 'internalNotes', 'walkNotes', 'photos', 'history']
  for (const [k, v] of Object.entries(obj)) {
    if (skipKeys.includes(k)) continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
      clean[k] = v
    }
  }
  return clean
}
