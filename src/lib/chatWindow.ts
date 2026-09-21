import { BRAND } from '@/lib/brand'

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

export type ChatAudience = 'family' | 'walker'

/**
 * Qué decirle a quien no puede escribir todavía, o ya no.
 *
 * A la familia no se le manda a "administración": ya no le escribe ahí. Si
 * necesita algo fuera del horario del paseo, el canal es el WhatsApp del
 * negocio. Al paseador sí: su hilo con administración sigue existiendo.
 */
export function chatWindowNotice(state: ChatWindowState, date: string, start: string, audience: ChatAudience = 'walker'): string {
  if (state === 'open') return ''
  const elsewhere = audience === 'family'
    ? `escríbenos por WhatsApp al ${BRAND.displayPhone}`
    : 'escríbele a administración'
  if (state === 'too-early') {
    return `Este hilo se abre dos horas antes del paseo (${date} a las ${start}). Si necesitas algo antes, ${elsewhere}.`
  }
  if (state === 'closed') {
    return `Este paseo ya pasó y su hilo está cerrado. Puedes leer lo que se escribió; para algo nuevo, ${elsewhere}.`
  }
  // Sin una hora válida no se puede saber cuándo abre, y las reglas tampoco
  // lo dejarían escribir: mejor decirlo que ofrecer un campo que va a fallar.
  return 'Este paseo todavía no tiene una hora confirmada, así que su hilo aún no se abre.'
}

/**
 * De todos los paseos con paseador, el que tiene sentido mostrar en el chat.
 *
 * La lista llega de la fecha más antigua a la más nueva, y quedarse con el
 * primero enseñaba un paseo de hace dos semanas que nunca se cerró en vez del de
 * hoy. Va primero el que está abierto ahora (el más cercano a su hora); si no
 * hay, el próximo que se abrirá; si tampoco, el último que ya pasó; y al final
 * los que no tienen hora válida.
 */
export function pickChatWalk<T extends { status: string; walkerId?: string; scheduledDate: string; scheduledStart: string }>(
  walks: readonly T[],
  openStatuses: ReadonlySet<string>,
  nowMs = Date.now(),
): T | null {
  const rankOf = (walk: T): [number, number] => {
    const startMs = walkStartMs(walk.scheduledDate, walk.scheduledStart)
    switch (chatWindowState(walk.scheduledDate, walk.scheduledStart, nowMs)) {
      case 'open': return [0, Math.abs((startMs ?? nowMs) - nowMs)]
      case 'too-early': return [1, (startMs ?? nowMs) - nowMs]
      case 'closed': return [2, nowMs - (startMs ?? nowMs)]
      default: return [3, 0]
    }
  }
  return walks
    .filter((walk) => openStatuses.has(walk.status) && Boolean(walk.walkerId))
    .map((walk) => ({ walk, rank: rankOf(walk) }))
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1])[0]?.walk ?? null
}
