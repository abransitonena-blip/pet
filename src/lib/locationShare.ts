/**
 * Enlace temporal para ver, sin cuenta, dónde va un paseo mientras ocurre.
 *
 * REQUIERE VALIDACIÓN DE ABOGADO EN MÉXICO antes de ofrecerlo de verdad:
 * compartir la ubicación de alguien con un tercero es un dato personal que
 * sale de la cuenta, y el aviso que lo cubra es una decisión legal, no
 * técnica (ver PLAN.md fase 36 y TRACKING_POLICY.md). Por eso el código no
 * decide por el dueño: `FEATURE_FLAGS.LOCATION_SHARE_LINKS_ENABLED` dice que
 * el mecanismo ya está listo y probado, igual que PET_AHORA_ENABLED, y el
 * interruptor real vive en Configuración → Funcionalidades
 * (`appSettings/public.features.locationShareLinksEnabled`), donde el dueño
 * también escribe el aviso (`locationSharePrivacyNotice`). Sin ese texto no
 * hay enlace, aunque el interruptor esté encendido -- ver
 * `isLocationSharingConfigured` abajo, que el servidor vuelve a comprobar
 * en cada creación y cada vista pública: a diferencia de PET_AHORA_ENABLED,
 * aquí el interruptor de Firestore no es solo cosmético.
 *
 * El token es el secreto -- 128 bits, igual que el de la placa de emergencia
 * (`emergencyProfile.ts`) -- y vive en un documento server-only
 * (`walkShareLinks/{token}`): ninguna regla de Firestore puede condicionar un
 * acceso a "si conoces el secreto", así que la colección se cierra por
 * completo (`allow read, write: if false`) y sólo el servidor, con su
 * identidad privilegiada, decide quién ve qué.
 */

export const SHARE_LINK_MIN_MINUTES = 15
export const SHARE_LINK_MAX_MINUTES = 180
const TOKEN_BYTES = 16 // 128 bits de entropía, como generatePublicSlug()

/**
 * Token aleatorio no adivinable, con Web Crypto -- igual que
 * generatePublicSlug() en emergencyProfile.ts, y por la misma razón: es una
 * API global (`crypto.getRandomValues`), no un módulo de Node, así que este
 * archivo se puede importar tanto desde una ruta de servidor como desde un
 * componente de cliente sin romper el empaquetado.
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Un token con la forma que genera generateShareToken -- para validar params de ruta. */
export function isShareToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{20,24}$/.test(value)
}

/** Nunca menos de 15 minutos ni más de 3 horas, sin importar lo que pida el cliente. */
export function clampShareMinutes(requested: unknown): number {
  const value = typeof requested === 'number' && Number.isFinite(requested)
    ? Math.round(requested)
    : SHARE_LINK_MAX_MINUTES
  return Math.min(SHARE_LINK_MAX_MINUTES, Math.max(SHARE_LINK_MIN_MINUTES, value))
}

export interface ShareLinkRecord {
  revokedAtMs: number | null
  expiresAtMs: number
}

/** Vigente: nadie lo apagó y no caducó. */
export function isShareLinkActive(share: ShareLinkRecord | null, nowMs: number): boolean {
  if (!share) return false
  if (share.revokedAtMs !== null) return false
  return share.expiresAtMs > nowMs
}

export interface LocationShareSettings {
  /** `appSettings/public.features.locationShareLinksEnabled`, decidido por el dueño. */
  enabled: boolean
  /** `appSettings/public.locationSharePrivacyNotice`, ya sin espacios de sobra. */
  notice: string
}

/** Lee el documento `appSettings/public` tal cual lo da Firestore -- cliente o servidor. */
export function readLocationShareSettings(data: Record<string, unknown> | undefined): LocationShareSettings {
  const features = data?.features
  const featuresRecord = features && typeof features === 'object' ? features as Record<string, unknown> : null
  const notice = typeof data?.locationSharePrivacyNotice === 'string' ? data.locationSharePrivacyNotice.trim() : ''
  return { enabled: featuresRecord?.locationShareLinksEnabled === true, notice }
}

/**
 * El dueño prendió el interruptor Y ya escribió el aviso. Sin las dos cosas
 * no hay enlace -- ni para crear uno nuevo, ni para ver uno que ya existía.
 */
export function isLocationSharingConfigured(settings: LocationShareSettings): boolean {
  return settings.enabled && settings.notice !== ''
}
