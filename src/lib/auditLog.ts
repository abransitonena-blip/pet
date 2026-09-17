import { getAuth } from 'firebase/auth'

export type AuditAction = 'create' | 'update' | 'delete' | 'assign' | 'cancel' | 'complete'
export type AuditEntity = 'reservation' | 'serviceOrder' | 'walkSession' | 'coupon' | 'customer' | 'walker' | 'review'

interface AuditLogParams {
  action: AuditAction
  entity: AuditEntity
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  meta?: Record<string, unknown>
}

/** Writes through /api/admin/audit-log -- see that route for why this isn't a direct Firestore write. */
export async function logAudit({ action, entity, entityId, before, after, meta }: AuditLogParams): Promise<void> {
  try {
    const token = await getAuth().currentUser?.getIdToken()
    if (!token) return
    await fetch('/api/admin/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, entity, entityId, before, after, meta }),
    })
  } catch {
    console.warn('[audit] Failed to write audit log')
  }
}
