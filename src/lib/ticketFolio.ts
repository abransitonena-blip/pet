/**
 * El folio que lee una persona.
 *
 * El folio guardado es `TKT-<id del paseo>`: veinticuatro caracteres que nadie
 * dicta por teléfono ni apunta en una libreta. No se puede acortar en la base
 * de datos, porque cada ticket valida que su folio coincida exactamente con su
 * id -- cambiarlo rompería los tickets que ya existen.
 *
 * Así que el folio corto es el mismo folio recortado: sus últimos seis
 * caracteres en mayúsculas. Eso es lo que se imprime y lo que se ve en
 * pantalla; el largo sigue a la mano como referencia técnica y sigue siendo lo
 * que se guarda.
 */

export const SHORT_FOLIO_LENGTH = 6

/** Los últimos seis caracteres del folio, en mayúsculas. */
export function shortFolio(folio: string): string {
  const clean = folio.trim().replace(/[^A-Za-z0-9]/g, '')
  if (clean.length === 0) return ''
  return clean.slice(-SHORT_FOLIO_LENGTH).toUpperCase()
}

/**
 * Lo que escribió alguien en el buscador: un folio corto no trae guiones y es
 * cortito; el largo empieza con `TKT-`.
 */
export function looksLikeShortFolio(value: string): boolean {
  const clean = value.trim()
  return clean.length > 0 && clean.length <= SHORT_FOLIO_LENGTH && !clean.includes('-')
}

/** ¿Este folio largo corresponde a ese código corto? */
export function matchesShortFolio(folio: string, code: string): boolean {
  const target = shortFolio(code)
  return target.length > 0 && shortFolio(folio) === target
}
