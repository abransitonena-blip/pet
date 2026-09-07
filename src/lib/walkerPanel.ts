import type { SessionStatus } from '@/lib/sessionMachine'
import type { WalkSession } from '@/types'

export type WalkerReadError = 'permission-denied' | 'network-error' | 'unavailable'

export interface WalkerTransition {
  from: SessionStatus
  to: SessionStatus
  label: string
  timestampField: 'confirmedAt' | 'onTheWayAt' | 'arrivedAt' | 'startedAt' | 'completedAt'
}

export const WALKER_TIMELINE = [
  { status: 'assigned', label: 'Asignado' },
  { status: 'confirmed', label: 'Confirmado' },
  { status: 'on_the_way', label: 'En camino' },
  { status: 'arrived', label: 'Llegó' },
  { status: 'in_progress', label: 'En paseo' },
  { status: 'completed', label: 'Completado' },
] as const satisfies ReadonlyArray<{ status: SessionStatus; label: string }>

export function walkerTimelinePosition(status: SessionStatus): number {
  return WALKER_TIMELINE.findIndex((item) => item.status === status)
}

const WALKER_TRANSITIONS: Partial<Record<SessionStatus, Omit<WalkerTransition, 'from'>>> = {
  assigned: { to: 'confirmed', label: 'Confirmar paseo', timestampField: 'confirmedAt' },
  confirmed: { to: 'on_the_way', label: 'Ir en camino', timestampField: 'onTheWayAt' },
  on_the_way: { to: 'arrived', label: 'Marcar llegada', timestampField: 'arrivedAt' },
  arrived: { to: 'in_progress', label: 'Iniciar paseo', timestampField: 'startedAt' },
  in_progress: { to: 'completed', label: 'Completar paseo', timestampField: 'completedAt' },
}

export function getWalkerTransition(status: SessionStatus): WalkerTransition | null {
  const next = WALKER_TRANSITIONS[status]
  return next ? { from: status, ...next } : null
}

export function classifyWalkerReadError(error: unknown): WalkerReadError {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
  if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'permission-denied'
  if (code === 'unavailable' || code === 'firestore/unavailable') return 'unavailable'
  return 'network-error'
}

export function walkerReadErrorMessage(error: WalkerReadError): string {
  if (error === 'permission-denied') {
    return 'Tu sesión no tiene permiso para consultar estos paseos. Cierra sesión y vuelve a entrar; si continúa, contacta a administración.'
  }
  if (error === 'unavailable') {
    return 'El servicio de paseos no está disponible temporalmente. Conserva esta pantalla abierta e inténtalo de nuevo.'
  }
  return 'No pudimos consultar tus paseos. Revisa tu conexión e inténtalo de nuevo.'
}

export function walkerSessionStatus(session: WalkSession): SessionStatus {
  return session.status ?? session.sessionStatus
}

export function walkerSessionDate(session: WalkSession): string {
  return session.scheduledDate ?? session.date ?? ''
}

export function walkerSessionStart(session: WalkSession): string {
  return session.scheduledStart ?? session.startTime ?? ''
}

export function isAssignedToWalker(session: Pick<WalkSession, 'walkerId'>, walkerId: string): boolean {
  return Boolean(walkerId) && session.walkerId === walkerId
}

export function sortWalkerSessions(sessions: WalkSession[], direction: 'asc' | 'desc' = 'asc'): WalkSession[] {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...sessions].sort((a, b) => {
    const left = `${walkerSessionDate(a)}T${walkerSessionStart(a) || '00:00'}`
    const right = `${walkerSessionDate(b)}T${walkerSessionStart(b) || '00:00'}`
    return left.localeCompare(right) * multiplier
  })
}
