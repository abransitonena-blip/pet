'use client'

import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/db'
import type { WalkSessionStatus } from '@/lib/domainStates'

/**
 * Una familia cancela su propio paseo.
 *
 * Hasta ahora no había forma de hacerlo desde la app: había que escribir por
 * WhatsApp y esperar a que alguien lo moviera a mano. La regla de Firestore
 * permite exactamente esto y nada más -- ni cambiar la fecha, ni el paseador, ni
 * tocar el paseo de otra persona -- y sólo mientras nadie haya salido todavía.
 *
 * No hay dinero de por medio: cancelar cambia el estado, no devuelve ni cobra
 * nada. Si alguna vez lo hubiera, esto tendría que pasar por el servidor.
 */

/** Los estados en los que todavía se puede cancelar desde la app. */
export const CANCELLABLE_STATUSES: readonly WalkSessionStatus[] = [
  'requested', 'pending_assignment', 'assigned', 'confirmed',
]

export const CANCEL_REASON_LIMIT = 300

export type CancelWalkResult =
  | { ok: true }
  | { ok: false; reason: 'too-late' | 'not-allowed' | 'failed' }

export function canCancel(status: WalkSessionStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status)
}

export async function cancelOwnWalk(input: {
  sessionId: string
  uid: string
  status: WalkSessionStatus
  reason?: string
}): Promise<CancelWalkResult> {
  if (!canCancel(input.status)) return { ok: false, reason: 'too-late' }
  const reason = (input.reason ?? '').trim().slice(0, CANCEL_REASON_LIMIT)
  try {
    await updateDoc(doc(db, 'walkSessions', input.sessionId), {
      status: 'cancelled',
      cancelledBy: input.uid,
      cancelledAt: serverTimestamp(),
      ...(reason ? { cancelReason: reason } : {}),
      updatedAt: serverTimestamp(),
    })
    return { ok: true }
  } catch (cause) {
    const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
    // Permiso denegado aquí casi siempre significa que el paseo avanzó mientras
    // la pantalla estaba abierta: alguien ya salió.
    return { ok: false, reason: code.includes('permission-denied') ? 'not-allowed' : 'failed' }
  }
}

/**
 * Mover el paseo a otro día u hora.
 *
 * Mover suelta al paseador: puede no estar libre a la hora nueva, así que el
 * paseo vuelve a la cola como solicitado y el equipo lo reasigna. Eso se le
 * dice a la familia antes de confirmar, no después.
 */
export async function rescheduleOwnWalk(input: {
  sessionId: string
  uid: string
  status: WalkSessionStatus
  date: string
  start: string
  end: string
}): Promise<CancelWalkResult> {
  if (!canCancel(input.status)) return { ok: false, reason: 'too-late' }
  try {
    await updateDoc(doc(db, 'walkSessions', input.sessionId), {
      scheduledDate: input.date,
      scheduledStart: input.start,
      arrivalWindowStart: input.start,
      arrivalWindowEnd: input.end,
      status: 'requested',
      walkerId: '',
      rescheduledBy: input.uid,
      rescheduledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { ok: true }
  } catch (cause) {
    const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
    return { ok: false, reason: code.includes('permission-denied') ? 'not-allowed' : 'failed' }
  }
}

export function cancelErrorMessage(reason: Exclude<CancelWalkResult, { ok: true }>['reason']): string {
  if (reason === 'too-late') return 'Este paseo ya empezó. Escríbele a tu paseador para avisarle.'
  if (reason === 'not-allowed') return 'El paseo cambió mientras mirabas esta pantalla. Actualízala para ver cómo quedó.'
  return 'No pudimos cancelar el paseo. Revisa tu conexión e inténtalo de nuevo.'
}
