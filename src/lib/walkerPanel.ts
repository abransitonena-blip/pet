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

/** Estados de un paseo de hoy que todavía piden algo al paseador. */
const OPEN_TODAY: ReadonlySet<SessionStatus> = new Set<SessionStatus>(['assigned', 'confirmed', 'on_the_way', 'arrived'])
/** Lo que ya está en marcha va antes que lo que sólo está agendado. */
const UNDERWAY: readonly SessionStatus[] = ['in_progress', 'arrived', 'on_the_way']
const CLOSED: ReadonlySet<SessionStatus> = new Set<SessionStatus>(['completed', 'cancelled', 'no_show'])

export interface WalkerDay {
  /** El paseo que toca atender ahora, o null si hoy no queda nada abierto. */
  focus: WalkSession | null
  /** Los demás paseos de hoy, en orden de hora. */
  restOfToday: WalkSession[]
  pendingToday: number
  activeToday: number
  completedToday: number
  /** Los siguientes tres paseos después de hoy. */
  upcoming: WalkSession[]
  /** Completados desde `weekStart` y antes de hoy, el más reciente primero. */
  recentCompleted: WalkSession[]
  /** Paseos de los últimos siete días sin contar cancelados ni ausencias. */
  lastWeekCount: number
}

/**
 * Ordena la jornada para una pantalla de teléfono: primero lo que hay que
 * hacer, luego lo demás. Espera sesiones ya ordenadas por fecha y hora.
 */
export function planWalkerDay(sorted: readonly WalkSession[], today: string, weekStart: string): WalkerDay {
  const todaySessions = sorted.filter((session) => walkerSessionDate(session) === today)
  const underway = UNDERWAY
    .map((status) => todaySessions.find((session) => walkerSessionStatus(session) === status))
    .find(Boolean)
  const focus = underway ?? todaySessions.find((session) => OPEN_TODAY.has(walkerSessionStatus(session))) ?? null

  return {
    focus,
    restOfToday: todaySessions.filter((session) => session !== focus),
    pendingToday: todaySessions.filter((session) => OPEN_TODAY.has(walkerSessionStatus(session))).length,
    activeToday: todaySessions.filter((session) => walkerSessionStatus(session) === 'in_progress').length,
    completedToday: todaySessions.filter((session) => walkerSessionStatus(session) === 'completed').length,
    upcoming: sorted
      .filter((session) => walkerSessionDate(session) > today && !CLOSED.has(walkerSessionStatus(session)))
      .slice(0, 3),
    recentCompleted: sorted
      .filter((session) => {
        const date = walkerSessionDate(session)
        return date >= weekStart && date < today && walkerSessionStatus(session) === 'completed'
      })
      .reverse(),
    lastWeekCount: sorted.filter((session) => {
      const date = walkerSessionDate(session)
      const status = walkerSessionStatus(session)
      return date >= weekStart && date <= today && status !== 'cancelled' && status !== 'no_show'
    }).length,
  }
}
