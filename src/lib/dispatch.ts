import type { Walker, Zone } from '@/types'

export interface DispatchCandidate {
  walker: Walker
  score: number
  reasons: string[]
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

  const daySchedule = walker.schedule?.[dayOfWeek] || []
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
