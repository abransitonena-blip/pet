import type { Announcement } from '@/lib/defaultConfig'

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Active means admin-enabled AND today falls inside [startDate, endDate], both inclusive. */
export function getActiveAnnouncements(announcements: Announcement[], now = new Date()): Announcement[] {
  const today = isoDate(now)
  return announcements.filter((item) => item.active && item.startDate <= today && today <= item.endDate)
}

/** Third Sunday of July, per the Mexican government's own observance (SADER). */
function thirdSundayOfJuly(year: number): Date {
  const first = new Date(Date.UTC(year, 6, 1))
  const firstSunday = 1 + ((7 - first.getUTCDay()) % 7)
  return new Date(Date.UTC(year, 6, firstSunday + 14))
}

export interface DateShortcut {
  label: string
  startDate: string
  endDate: string
}

/**
 * Pre-fills date fields only — the admin still writes their own title and
 * message. These are real, verifiable civic/observance dates, not invented
 * promotions or copy.
 */
export function mexicanObservanceShortcuts(year = new Date().getFullYear()): DateShortcut[] {
  const pad = (n: number) => String(n).padStart(2, '0')
  const range = (month: number, startDay: number, endDay = startDay) => ({
    startDate: `${year}-${pad(month)}-${pad(startDay)}`,
    endDate: `${year}-${pad(month)}-${pad(endDay)}`,
  })
  const dogDay = isoDate(thirdSundayOfJuly(year))
  return [
    { label: 'Día del Perro (México, tercer domingo de julio)', startDate: dogDay, endDate: dogDay },
    { label: 'Día Mundial del Perro (26 de agosto)', ...range(8, 26) },
    { label: 'Independencia de México (15-16 de septiembre)', ...range(9, 15, 16) },
    { label: 'Día de Muertos (1-2 de noviembre)', ...range(11, 1, 2) },
    { label: 'Navidad (24-25 de diciembre)', ...range(12, 24, 25) },
    { label: 'Año Nuevo (1 de enero)', ...range(1, 1) },
    { label: 'Día de Reyes (6 de enero)', ...range(1, 6) },
  ]
}
