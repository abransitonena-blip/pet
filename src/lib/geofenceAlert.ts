/**
 * Cuándo la salida de un paseador del área recomendada llega al teléfono de
 * quien opera, y qué dice.
 *
 * La alerta ya se guardaba y aparecía en un cartel DENTRO del panel de
 * administración. Un cartel dentro de un panel sólo lo ve quien lo tiene abierto
 * en ese momento: un paseador se salía del área y nadie se enteraba hasta que
 * alguien abría la pantalla. Ahora además llega como aviso al teléfono.
 *
 * El teléfono del paseador manda su posición cada ~2 minutos, así que una
 * salida produce decenas de lecturas fuera. El aviso NO sale con cada una: sale
 * la primera vez, cuando la alerta se reabre después de que administración la
 * marcó, y como recordatorio si sigue abierta y nadie la atiende.
 *
 * Es una función pura, para probar la decisión sin mandar un solo aviso.
 */

/** Cada cuánto se recuerda una alerta abierta que nadie ha atendido. */
export const GEOFENCE_REPEAT_MS = 30 * 60_000

export interface ExistingAlert {
  status?: string
  /** Cuándo se avisó por última vez, en milisegundos; ausente si nunca. */
  lastNotifiedAtMs?: number
}

export type NotifyReason = 'first' | 'reopened' | 'reminder'

/** ¿Toca avisar en esta lectura? `null` si no hay alerta previa. */
export function geofenceNotifyReason(existing: ExistingAlert | null, nowMs: number): NotifyReason | null {
  if (!existing) return 'first'
  // Administración ya la había marcado y el paseador volvió a salir: pide ojos otra vez.
  if (existing.status === 'acknowledged') return 'reopened'
  if (typeof existing.lastNotifiedAtMs !== 'number') return 'reminder'
  return nowMs - existing.lastNotifiedAtMs >= GEOFENCE_REPEAT_MS ? 'reminder' : null
}

export interface GeofencePush {
  title: string
  body: string
  url: string
  tag: string
}

/**
 * El texto del aviso. No lleva coordenadas: sale en la pantalla bloqueada, y la
 * posición exacta se ve dentro del panel, con sesión.
 */
export function buildGeofencePush(input: { walkerName: string; zoneName: string; sessionId: string; reason: NotifyReason }): GeofencePush {
  const walker = input.walkerName.trim() || 'Un paseador'
  const area = input.zoneName.trim() ? ` (${input.zoneName.trim()})` : ''
  const lead = input.reason === 'reminder' ? 'Sigue fuera del área recomendada' : 'Salió del área recomendada'
  return {
    title: `${walker}: ${lead.toLowerCase()}`,
    body: `${walker} está fuera del área recomendada${area} durante un paseo. Revisa si todo va bien y márcalo en Rutas.`,
    url: '/admin/rutas',
    // Un solo aviso por paseo en la bandeja: el recordatorio reemplaza al anterior en vez de apilarse.
    tag: `geofence-${input.sessionId}`,
  }
}
