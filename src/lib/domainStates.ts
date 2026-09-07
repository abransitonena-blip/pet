export const SERVICE_ORDER_STATUSES = [
  'draft',
  'pending_confirmation',
  'confirmed',
  'partially_completed',
  'completed',
  'cancelled',
] as const

export const WALK_SESSION_STATUSES = [
  'requested',
  'pending_assignment',
  'assigned',
  'confirmed',
  'on_the_way',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
] as const

export const PAYMENT_STATUSES = [
  'pending',
  'proof_uploaded',
  'under_review',
  'confirmed',
  'rejected',
  'refunded',
] as const

export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number]
export type WalkSessionStatus = (typeof WALK_SESSION_STATUSES)[number]
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export function isWalkSessionStatus(value: unknown): value is WalkSessionStatus {
  return typeof value === 'string'
    && (WALK_SESSION_STATUSES as readonly string[]).includes(value)
}
