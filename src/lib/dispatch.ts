import type { Walker } from '@/types'

export interface DispatchCandidate {
  walker: Walker
  score: number
  reasons: string[]
}

export type DaySlot = { start: string; end: string }

/**
 * Three spellings of the same week live in this codebase: the walker's own
 * profile screen stores `monday`…`sunday`, the older admin tooling stored
 * `lun`…`dom`, and dispatch asks for `lunes`…`domingo`. Looking a day up by one
 * spelling only is why a walker's declared availability was never matched --
 * every walker scored "fuera de horario" no matter what they had declared.
 * Any alias of a day finds that day's ranges under any other alias.
 */
const DAY_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ['sunday', 'domingo', 'dom'],
  ['monday', 'lunes', 'lun'],
  ['tuesday', 'martes', 'mar'],
  ['wednesday', 'miercoles', 'miércoles', 'mie', 'mié'],
  ['thursday', 'jueves', 'jue'],
  ['friday', 'viernes', 'vie'],
  ['saturday', 'sabado', 'sábado', 'sab', 'sáb'],
]

export function daySlots(schedule: Record<string, DaySlot[] | undefined> | undefined, day: string): DaySlot[] {
  if (!schedule) return []
  const aliases = DAY_ALIAS_GROUPS.find((group) => group.includes(day)) ?? [day]
  for (const key of aliases) {
    const slots = schedule[key]
    if (Array.isArray(slots) && slots.length > 0) return slots
  }
  return []
}

const BUSINESS_TIME_ZONE = 'America/Mexico_City'
const WEEKDAY_TO_KEY: Record<string, string> = {
  Sunday: 'domingo', Monday: 'lunes', Tuesday: 'martes', Wednesday: 'miercoles',
  Thursday: 'jueves', Friday: 'viernes', Saturday: 'sabado',
}

/**
 * Day and time as a walker in Mexico City reads them. Server code runs in UTC
 * on Vercel, so `getDay()`/`getHours()` there would put a 7 p.m. request on
 * the next day at 01:00 and score every walker against the wrong schedule.
 */
export function businessClock(now: Date): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return {
    day: WEEKDAY_TO_KEY[part('weekday')] ?? 'lunes',
    time: `${part('hour').padStart(2, '0')}:${part('minute').padStart(2, '0')}`,
  }
}

export function scoreWalker(walker: Walker, zoneId: string, dayOfWeek: string, time: string): DispatchCandidate {
  const reasons: string[] = []
  let score = 0

  if (walker.status !== 'active') {
    return { walker, score: -1, reasons: ['Paseador inactivo'] }
  }

  const hasZone = walker.zones?.includes(zoneId)
  if (hasZone) {
    score += 30
    reasons.push('Zona asignada')
  } else {
    score -= 20
    reasons.push('Fuera de zona')
  }

  const daySchedule = daySlots(walker.schedule, dayOfWeek)
  const isAvailable = daySchedule.some((slot) => time >= slot.start && time <= slot.end)
  if (isAvailable) {
    score += 30
    reasons.push('Horario disponible')
  } else {
    score -= 30
    reasons.push('Fuera de horario')
  }

  const load = walker.currentLoad?.todayAssigned ?? 0
  const max = walker.capacity?.maxDaily ?? 8
  if (load < max) {
    score += 20 * (1 - load / max)
    reasons.push(`Carga: ${load}/${max}`)
  } else {
    score -= 20
    reasons.push('Capacidad llena')
  }

  const rating = walker.performance?.rating ?? 0
  score += rating * 5
  if (rating > 0) reasons.push(`Calificación: ${rating}★`)

  return { walker, score, reasons }
}

export function selectBestWalker(walkers: Walker[], zoneId: string, dayOfWeek: string, time: string): DispatchCandidate | null {
  const candidates = walkers
    .map((w) => scoreWalker(w, zoneId, dayOfWeek, time))
    .filter((c) => c.score >= 0)
    .sort((a, b) => b.score - a.score)

  return candidates[0] || null
}
