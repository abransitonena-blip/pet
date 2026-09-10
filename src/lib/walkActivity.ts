import type { CanonicalWalkSession, SessionStep } from '@/lib/useCanonicalWalkSessions'

/**
 * Actividad de los paseos, derivada de las sesiones.
 *
 * Every step of a walk already leaves a timestamp on its session -- the
 * Firestore rules require one on each transition -- so the family's activity
 * feed can be read off the sessions instead of being written somewhere else.
 * Nothing new is stored, and the feed cannot drift from what happened.
 */

export interface WalkActivityItem {
  id: string
  sessionId: string
  step: SessionStep
  at: number
  title: string
  message: string
  href?: string
}

const COPY: Record<SessionStep, (dog: string) => { title: string; message: string }> = {
  requested: (dog) => ({
    title: 'Solicitud recibida',
    message: `Registramos la solicitud de paseo para ${dog}. Recibirás un aviso cuando tenga paseador asignado.`,
  }),
  assigned: (dog) => ({ title: 'Paseador asignado', message: `El paseo de ${dog} ya tiene paseador asignado.` }),
  confirmed: (dog) => ({ title: 'Paseo confirmado', message: `El paseador confirmó el paseo de ${dog}.` }),
  on_the_way: (dog) => ({ title: 'Paseador en camino', message: `El paseador va en camino para recoger a ${dog}.` }),
  arrived: (dog) => ({ title: 'Paseador en el domicilio', message: `El paseador llegó por ${dog}.` }),
  in_progress: (dog) => ({ title: 'Paseo en curso', message: `Inició el paseo de ${dog}.` }),
  completed: (dog) => ({
    title: 'Paseo terminado',
    message: `Terminó el paseo de ${dog}. El reporte aparece en cuanto el paseador lo envía.`,
  }),
}

/** Title and message for one step, shared by the in-app feed and push. */
export function walkStepCopy(step: SessionStep, dog: string): { title: string; message: string } {
  return COPY[step](dog)
}

export function deriveWalkActivity(
  sessions: CanonicalWalkSession[],
  dogNames: Record<string, string>,
): WalkActivityItem[] {
  return sessions
    .flatMap((session) => {
      const dog = session.dogIds.map((id) => dogNames[id]).filter(Boolean).join(' y ') || 'tu mascota'
      return (Object.entries(session.transitions ?? {}) as [SessionStep, number][]).map(([step, at]) => ({
        id: `${session.id}:${step}`,
        sessionId: session.id,
        step,
        at,
        ...COPY[step](dog),
        href: step === 'completed' ? `/familia/reportes/${encodeURIComponent(session.id)}` : undefined,
      }))
    })
    .sort((a, b) => b.at - a.at)
}
