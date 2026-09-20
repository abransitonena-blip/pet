import 'server-only'

import { verifyTokenRole } from '@/lib/serverAuth'
import { ROLES } from '@/lib/roles'

/**
 * Quién puede disparar una tarea programada.
 *
 * Dos llaves para la misma puerta:
 * - el secreto que manda Vercel en la cabecera, que es como corre a diario;
 * - una sesión de administración, para poder probarla hoy en vez de esperar a
 *   mañana. Sin esto, la única forma de saber si un recordatorio sale era
 *   esperar a las siete de la tarde y preguntarle a alguien.
 *
 * Nadie más: sin `CRON_SECRET` y sin sesión de equipo, la ruta no hace nada.
 */
export type CronCaller = 'cron' | 'staff' | null

export async function authorizeCronCall(request: Request): Promise<CronCaller> {
  const authorization = request.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''
  if (secret && authorization === `Bearer ${secret}`) return 'cron'

  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return null
  const caller = await verifyTokenRole(idToken)
  if (caller && (caller.role === ROLES.ADMIN || caller.role === ROLES.SUPERVISOR)) return 'staff'
  return null
}

/** Una prueba no manda nada ni deja marca: sólo cuenta lo que haría. */
export function isDryRun(request: Request): boolean {
  return new URL(request.url).searchParams.get('dryRun') === '1'
}
