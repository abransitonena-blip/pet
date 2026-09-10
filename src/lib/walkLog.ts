import { WALK_REPORT_TEXT_LIMITS, type WalkReportContent } from '@/lib/walkReports'

/**
 * Bitácora del paseo: registros rápidos mientras el paseo ocurre.
 *
 * Each tap appends one time-stamped line to the report field it belongs to.
 * The report keeps its existing fields and limits, so the Firestore rules that
 * already accept a walker's draft during the walk accept these lines too, and
 * the family reads them in the submitted report exactly as written.
 *
 * A line that would overflow a field is refused, never silently cut: a
 * truncated incident note is worse than an explicit "resume first".
 */

export type WalkLogEvent = 'pipi' | 'popo' | 'agua' | 'juego' | 'descanso' | 'incidente'

type TextField = 'bathroomNotes' | 'behaviorNotes' | 'incidentsSummary'

const EVENTS: Record<WalkLogEvent, { text: string; field: TextField }> = {
  pipi: { text: 'Pipí', field: 'bathroomNotes' },
  popo: { text: 'Popó', field: 'bathroomNotes' },
  agua: { text: 'Tomó agua', field: 'bathroomNotes' },
  juego: { text: 'Jugó', field: 'behaviorNotes' },
  descanso: { text: 'Descanso', field: 'behaviorNotes' },
  incidente: { text: 'Incidente', field: 'incidentsSummary' },
}

const MAX_DETAIL = 200

export type WalkLogResult =
  | { ok: true; content: WalkReportContent }
  | { ok: false; reason: 'too-long' | 'detail-required' }

/** Hora local de la Ciudad de México, `HH:MM`. */
export function walkLogTime(at: Date): string {
  return at.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Mexico_City',
  })
}

export function applyWalkLog(content: WalkReportContent, event: WalkLogEvent, at: Date, detail = ''): WalkLogResult {
  const { text, field } = EVENTS[event]
  const note = detail.trim().slice(0, MAX_DETAIL)
  if (event === 'incidente' && !note) return { ok: false, reason: 'detail-required' }

  const line = `${walkLogTime(at)} · ${text}${note ? `: ${note}` : ''}`
  const current = content[field]
  const next = current.trim() ? `${current.trimEnd()}\n${line}` : line
  if (next.length > WALK_REPORT_TEXT_LIMITS[field]) return { ok: false, reason: 'too-long' }

  return {
    ok: true,
    content: { ...content, [field]: next, waterProvided: content.waterProvided || event === 'agua' },
  }
}
