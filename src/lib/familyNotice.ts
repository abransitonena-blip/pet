/**
 * El aviso que administración le manda a una familia cuando un paseador salió del
 * área recomendada y hubo que revisarlo.
 *
 * Nunca sale solo. La salida se alerta primero a administración, que decide si
 * fue un percance o una vuelta más larga por el parque; sólo si decide avisar a
 * la familia, este texto -- que ve y puede editar antes de enviarlo -- llega a su
 * teléfono y a su panel. Un aviso automático por cada lectura de GPS le
 * mandaría a las familias un susto por cada árbol que tapa una señal.
 */

export const FAMILY_NOTICE_LIMIT = 240

/**
 * El texto de partida. Sólo afirma lo que es cierto en el momento de enviarlo:
 * el equipo lo vio y lo está revisando. No dice que algo grave ocurrió, porque
 * administración todavía no lo sabe.
 */
export function defaultFamilyNotice(input: { walkerName: string; dogName?: string }): string {
  const walker = input.walkerName.trim() || 'el paseador'
  const dog = input.dogName?.trim()
  return `Nuestro equipo vio que ${walker} salió del área recomendada durante el paseo${dog ? ` de ${dog}` : ''} y lo está revisando. Te avisaremos si hay algo más.`
}

export type FamilyNoticeCheck = 'ok' | 'empty' | 'too-long'

export function checkFamilyNotice(text: string): FamilyNoticeCheck {
  const trimmed = text.trim()
  if (!trimmed) return 'empty'
  return trimmed.length > FAMILY_NOTICE_LIMIT ? 'too-long' : 'ok'
}

export function familyNoticeMessage(check: Exclude<FamilyNoticeCheck, 'ok'>): string {
  return check === 'empty'
    ? 'Escribe qué le vas a decir a la familia.'
    : `El aviso no puede pasar de ${FAMILY_NOTICE_LIMIT} caracteres.`
}
