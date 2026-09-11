/**
 * Qué cierra el modo mantenimiento (Configuración → Mantenimiento).
 *
 * A blocklist, not an allowlist: only the public, informational pages close.
 * Anything not named here -- panels, login, cancellations, legal pages, the
 * API -- stays open, so a page added later can never be locked by accident.
 * New bookings are paused separately, where they are made.
 */
export const MAINTENANCE_BLOCKED_PATHS: readonly string[] = ['/', '/nosotros', '/equipo', '/preguntas-frecuentes']

export function isMaintenanceBlockedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return MAINTENANCE_BLOCKED_PATHS.includes(path)
}
