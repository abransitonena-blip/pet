import { formatShortDate } from '@/lib/customerSegments'

/** El día siguiente a `date` (YYYY-MM-DD), también al cruzar de mes o de año. */
export function nextDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

/** "Hoy", "Mañana" o la fecha corta. `today` va en YYYY-MM-DD, hora local. */
export function whenLabel(date: string, today: string): string {
  if (date === today) return 'Hoy'
  if (date === nextDay(today)) return 'Mañana'
  return formatShortDate(date) || date
}
