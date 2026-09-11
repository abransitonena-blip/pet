import type { Zone, ZoneSpot } from '@/types'

/**
 * Zonas por código postal.
 *
 * Owner decision: la familia escribe su CP y la dirección queda en la zona que
 * lo cubre, como en las apps de reparto. Un CP no dibuja un borde en el mapa,
 * así que el aviso de "el paseador salió de la zona" sigue usando el centro y
 * el radio de la zona; esto solo resuelve a qué zona pertenece una dirección.
 */

export const ZONE_SPOT_KINDS: readonly ZoneSpot['kind'][] = ['parque', 'recomendado', 'evitar']

export const ZONE_SPOT_LABELS: Record<ZoneSpot['kind'], string> = {
  parque: 'Parque',
  recomendado: 'Buen lugar para pasear',
  evitar: 'Mejor evitar',
}

const POSTAL_CODE_PATTERN = /^\d{5}$/

/**
 * Devuelve el CP de 5 dígitos, o '' si lo escrito no lo es. No recorta: seis
 * dígitos no son un código postal con un dígito de sobra, son otra cosa.
 */
export function normalizePostalCode(value: string): string {
  const digits = value.replace(/\D/g, '')
  return POSTAL_CODE_PATTERN.test(digits) ? digits : ''
}

/** Acepta "06700, 06600 06140" y devuelve los códigos válidos, sin repetir. */
export function parsePostalCodes(value: string): string[] {
  return Array.from(new Set(value.split(/[\s,;]+/).map(normalizePostalCode).filter(Boolean)))
}

type ZoneLike = Pick<Zone, 'id' | 'name' | 'active'> & { postalCodes?: string[] }

/** La zona activa que cubre ese código postal, o null si ninguna lo cubre. */
export function zoneForPostalCode<T extends ZoneLike>(zones: readonly T[], postalCode: string): T | null {
  const code = normalizePostalCode(postalCode)
  if (!code) return null
  return zones.find((zone) => zone.active && (zone.postalCodes ?? []).includes(code)) ?? null
}

/**
 * Códigos que aparecen en más de una zona activa. Un CP repetido haría que la
 * misma dirección cayera en dos zonas distintas según el orden de lectura, así
 * que el panel lo avisa en vez de elegir por su cuenta.
 */
export function duplicatedPostalCodes(zones: readonly ZoneLike[]): string[] {
  const seen = new Map<string, number>()
  for (const zone of zones) {
    if (!zone.active) continue
    // Array.from: recorrer un Set directamente no funciona con el objetivo de
    // compilación de este proyecto, y falla en silencio sin recorrer nada.
    for (const code of Array.from(new Set(zone.postalCodes ?? []))) {
      seen.set(code, (seen.get(code) ?? 0) + 1)
    }
  }
  return Array.from(seen.entries()).filter(([, count]) => count > 1).map(([code]) => code).sort()
}

/** Un punto es utilizable si trae coordenadas reales. */
export function isUsableSpot(spot: Pick<ZoneSpot, 'lat' | 'lng'>): boolean {
  return Number.isFinite(spot.lat) && Number.isFinite(spot.lng) && (spot.lat !== 0 || spot.lng !== 0)
}
