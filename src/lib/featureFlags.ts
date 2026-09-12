export const FEATURE_FLAG_NAMES = [
  'PET_AHORA_ENABLED',
  'WALLET_MUTATIONS_ENABLED',
  'LOYALTY_REDEMPTION_ENABLED',
  'AUTOMATIC_REFERRALS_ENABLED',
  'FCM_ENABLED',
  'AUTOMATED_REMINDERS_ENABLED',
  'PUBLIC_REVIEWS_ENABLED',
  'PUBLIC_PHONE_CANCELLATION_ENABLED',
  'PRIVATE_MEDIA_UPLOADS_ENABLED',
  'CLOUD_FUNCTIONS_ENABLED',
  'LEGACY_RESERVATION_WRITES_ENABLED',
  'WALK_REPORTS_ENABLED',
  'FINANCE_PAYMENTS_ENABLED',
  'BLUETOOTH_PRINTING_ENABLED',
  'WALK_TRACKING_ENABLED',
  // J: perfil de emergencia con QR por mascota (opt-in, apagado por defecto)
  'PET_EMERGENCY_QR_ENABLED',
  // K: panel de analítica de segmentos de gasto de clientes (apagado por defecto)
  'CLIENT_SPEND_SEGMENT_ANALYTICS_ENABLED',
] as const

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number]
export type FeatureFlags = Readonly<Record<FeatureFlagName, boolean>>

// MVP containment defaults. These flags are intentionally static and public-safe:
// enabling one requires a reviewed code change and a tested trusted backend.
export const FEATURE_FLAGS: FeatureFlags = Object.freeze({
  // Encendido por decisión del dueño. El interruptor operativo sigue siendo
  // `config.features.petAhoraEnabled` en Configuración → Funcionalidades: el
  // código está listo, pero mostrar reserva inmediata a las familias sin
  // paseadores activos en zona produce solicitudes que expiran solas.
  PET_AHORA_ENABLED: true,
  WALLET_MUTATIONS_ENABLED: false,
  LOYALTY_REDEMPTION_ENABLED: false,
  AUTOMATIC_REFERRALS_ENABLED: false,
  FCM_ENABLED: false,
  AUTOMATED_REMINDERS_ENABLED: false,
  PUBLIC_REVIEWS_ENABLED: true,
  PUBLIC_PHONE_CANCELLATION_ENABLED: false,
  // Encendido por decisión del dueño para las fotos del paseo: privadas
  // (type=authenticated), visibles con enlaces que caducan. Ver MEDIA_POLICY.md.
  PRIVATE_MEDIA_UPLOADS_ENABLED: true,
  CLOUD_FUNCTIONS_ENABLED: false,
  LEGACY_RESERVATION_WRITES_ENABLED: false,
  WALK_REPORTS_ENABLED: true,
  FINANCE_PAYMENTS_ENABLED: false,
  // Encendido por decisión del dueño para probarlo con la impresora física.
  // Web Bluetooth solo existe en Chrome (Android o computadora), no en iPhone.
  BLUETOOTH_PRINTING_ENABLED: true,
  // Encendido por decisión del dueño: ubicación cada ~2 min solo durante un
  // paseo en curso, y alerta si el paseador sale de la zona.
  WALK_TRACKING_ENABLED: true,
  // J: perfil de emergencia con QR por mascota.
  // Encendido por decisión del dueño (2026-09-12), ya con las reglas de
  // `emergency-profiles` publicadas. Cada mascota tiene además su opt-in
  // individual (emergencyProfile.enabled): sin él no se publica nada, así que
  // este flag habilita la función, no expone perros.
  PET_EMERGENCY_QR_ENABLED: true,
  // K: segmentos de gasto de clientes (analítica interna, solo lectura).
  // El admin debe configurar los umbrales antes de que el panel sea útil.
  CLIENT_SPEND_SEGMENT_ANALYTICS_ENABLED: false,
})

export function isFeatureEnabled(flag: FeatureFlagName): boolean {
  return FEATURE_FLAGS[flag] === true
}
