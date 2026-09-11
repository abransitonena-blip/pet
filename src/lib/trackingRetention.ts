/**
 * Cuánto tiempo se conservan los datos de ubicación de un paseo.
 *
 * Owner decision: 30 días. Alcanza para revisar un reclamo o una alerta de
 * zona reciente, y después los puntos dejan de existir.
 *
 * El borrado lo hace Firestore con una política TTL sobre el campo
 * `expiresAt`, no un proceso nuestro: por eso cada punto y cada alerta se
 * guardan ya con su fecha de caducidad. Si la política no está encendida, el
 * dato no se borra solo -- ver TRACKING_POLICY.md.
 *
 * REQUIERE VALIDACIÓN DE ABOGADO EN MÉXICO: el plazo y su aviso a las
 * familias son una decisión legal, no técnica.
 */

export const TRACKING_RETENTION_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** Fecha en la que un punto capturado en `from` deja de conservarse. */
export function trackingExpiryDate(from: Date): Date {
  return new Date(from.getTime() + TRACKING_RETENTION_DAYS * DAY_MS)
}
