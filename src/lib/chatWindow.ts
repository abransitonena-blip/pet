/**
 * Cuándo está abierto el hilo de un paseo.
 *
 * El chat de un paseo sirve para ese paseo: avisar que vas llegando, que el
 * perro no quiso salir, que la puerta está trabada. Abierto para siempre se
 * convierte en otra cosa -- un canal permanente entre una familia y un paseador
 * --, y eso no es lo que el negocio ofrece.
 *
 * Dos horas antes y hasta tres después de la hora del paseo: lo que dura un
 * paseo más dos horas de margen por cualquier imprevisto. Las mismas cuentas
 * viven en las reglas de Firestore, que son las que mandan; esto es para que la
 * pantalla no invite a escribir donde la regla va a decir que no.
 */

/** La hora del negocio: Ciudad de México, UTC-6 todo el año desde 2022. */
const MEXICO_OFFSET_MS = 6 * 60 * 60_000
export const CHAT_OPENS_BEFORE_MS = 2 * 60 * 60_000
export const CHAT_CLOSES_AFTER_MS = 3 * 60 * 60_000

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export type ChatWindowState = 'open' | 'too-early' | 'closed' | 'unknown'

/** El instante del paseo, en milisegundos UTC. */
export function walkStartMs(date: string, start: string): number | null {
  if (!DATE_PATTERN.test(date) || !CLOCK_PATTERN.test(start)) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = start.split(':').map(Number)
  return Date.UTC(year, month - 1, day, hour, minute) + MEXICO_OFFSET_MS
}

export function chatWindowState(date: string, start: string, nowMs = Date.now()): ChatWindowState {
  const startMs = walkStartMs(date, start)
  if (startMs === null) return 'unknown'
  if (nowMs < startMs - CHAT_OPENS_BEFORE_MS) return 'too-early'
  if (nowMs > startMs + CHAT_CLOSES_AFTER_MS) return 'closed'
  return 'open'
}

/** Qué decirle a quien no puede escribir todavía, o ya no. */
export function chatWindowNotice(state: ChatWindowState, date: string, start: string): string {
  if (state === 'too-early') {
    return `Este hilo se abre dos horas antes del paseo (${date} a las ${start}). Si necesitas algo antes, escríbele a administración.`
  }
  if (state === 'closed') {
    return 'Este paseo ya pasó y su hilo está cerrado. Puedes leer lo que se escribió; para algo nuevo, escríbele a administración.'
  }
  return ''
}
