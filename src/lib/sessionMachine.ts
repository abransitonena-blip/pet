/**
 * Session state machine — single source of truth for valid transitions.
 *
 * PRD section 12 mandates: "Máquina de estados explícita en el código, no solo documentada."
 *
 * States:
 *   pending → assigned → walker_confirmed → on_the_way → arrived → in_progress → completed
 *   Any state → cancelled
 *   Any state → no_show (only from assigned/on_the_way/arrived)
 */

export type SessionStatus =
  | 'pending'
  | 'assigned'
  | 'walker_confirmed'
  | 'on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type AssignmentStatus =
  | 'unassigned'
  | 'client_preferred'
  | 'assigned'
  | 'confirmed'
  | 'rejected'

/** Valid transitions: from state → set of valid target states */
const TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  pending:          ['assigned', 'cancelled'],
  assigned:         ['walker_confirmed', 'cancelled', 'no_show'],
  walker_confirmed: ['on_the_way', 'cancelled', 'no_show'],
  on_the_way:       ['arrived', 'cancelled', 'no_show'],
  arrived:          ['in_progress', 'cancelled'],
  in_progress:      ['completed', 'cancelled'],
  completed:        [],
  cancelled:        [],
  no_show:          [],
}

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function transition(from: SessionStatus, to: SessionStatus): SessionStatus {
  if (!canTransition(from, to)) {
    console.warn(`[sessionMachine] Invalid transition: ${from} → ${to}`)
    return from
  }
  return to
}

/** Human-readable labels for session statuses */
export const STATUS_LABELS: Record<SessionStatus, string> = {
  pending:          'Pendiente',
  assigned:         'Asignado',
  walker_confirmed: 'Paseador confirmado',
  on_the_way:       'En camino',
  arrived:          'Llegó',
  in_progress:      'Paseando',
  completed:        'Completado',
  cancelled:        'Cancelado',
  no_show:          'No se presentó',
}

/** Legacy status aliases from reservations collection → new SessionStatus */
export const LEGACY_STATUS_MAP: Record<string, SessionStatus> = {
  pending:   'pending',
  assigned:  'assigned',
  en_camino: 'on_the_way',
  paseando:  'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show:   'no_show',
}

/** Status badge color class hints */
export const STATUS_COLORS: Record<SessionStatus, { bg: string; text: string }> = {
  pending:          { bg: 'bg-yellow-500/15', text: 'text-yellow-800' },
  assigned:         { bg: 'bg-brand-500/15', text: 'text-brand-600' },
  walker_confirmed: { bg: 'bg-blue-500/15', text: 'text-blue-700' },
  on_the_way:       { bg: 'bg-blue-500/10', text: 'text-blue-700' },
  arrived:          { bg: 'bg-purple-500/15', text: 'text-purple-700' },
  in_progress:      { bg: 'bg-success-500/20', text: 'text-success-600' },
  completed:        { bg: 'bg-success-500/15', text: 'text-success-600' },
  cancelled:        { bg: 'bg-danger-500/15', text: 'text-red-700' },
  no_show:          { bg: 'bg-orange-500/15', text: 'text-orange-800' },
}
