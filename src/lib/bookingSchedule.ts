export const BOOKING_TIMEZONE = 'America/Mexico_City' as const
export const BOOKING_SCHEDULE_SCHEMA_VERSION = 1
export const BOOKING_SLOT_INTERVALS = [15, 30, 60] as const

export const BOOKING_DAY_KEYS = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
] as const

export type BookingDayKey = (typeof BOOKING_DAY_KEYS)[number]

export interface BookingDaySchedule {
  enabled: boolean
  open: string
  close: string
}

export interface BookingSchedule {
  schemaVersion: 1
  timezone: typeof BOOKING_TIMEZONE
  slotIntervalMinutes: (typeof BOOKING_SLOT_INTERVALS)[number]
  minimumLeadMinutes: number
  weeklyHours: Record<BookingDayKey, BookingDaySchedule>
  closedDates: string[]
  active: boolean
  version: number
  updatedAt: unknown
  updatedBy: string
}

export type BookingScheduleStatus = 'loading' | 'ready' | 'missing' | 'invalid' | 'permission-denied' | 'network-error'

export interface BookingSlot {
  start: string
  end: string
  label: string
  startsAt: number
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function createEmptyBookingSchedule(): BookingSchedule {
  return {
    schemaVersion: BOOKING_SCHEDULE_SCHEMA_VERSION,
    timezone: BOOKING_TIMEZONE,
    slotIntervalMinutes: 15,
    minimumLeadMinutes: 0,
    weeklyHours: Object.fromEntries(BOOKING_DAY_KEYS.map((day) => [day, { enabled: false, open: '', close: '' }])) as Record<BookingDayKey, BookingDaySchedule>,
    closedDates: [],
    active: false,
    version: 0,
    updatedAt: null,
    updatedBy: '',
  }
}

export function timeToMinutes(value: string): number | null {
  if (!TIME_PATTERN.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function parseServiceDurationMinutes(value: string): number | null {
  const normalized = value.trim().toLowerCase()
  const minutes = normalized.match(/^(\d+)\s*min/)
  if (minutes) return Number(minutes[1])
  const hours = normalized.match(/^(\d+)\s*(?:hora|horas)/)
  if (hours) return Number(hours[1]) * 60
  return null
}

export function parseBookingSchedule(value: unknown): BookingSchedule | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (data.schemaVersion !== BOOKING_SCHEDULE_SCHEMA_VERSION || data.timezone !== BOOKING_TIMEZONE) return null
  if (!BOOKING_SLOT_INTERVALS.includes(data.slotIntervalMinutes as never)) return null
  if (!Number.isSafeInteger(data.minimumLeadMinutes) || Number(data.minimumLeadMinutes) < 0 || Number(data.minimumLeadMinutes) > 10_080) return null
  if (!Number.isSafeInteger(data.version) || Number(data.version) < 1 || typeof data.active !== 'boolean') return null
  if (!Array.isArray(data.closedDates) || data.closedDates.length > 366 || data.closedDates.some((date) => typeof date !== 'string' || !DATE_PATTERN.test(date))) return null
  if (!data.weeklyHours || typeof data.weeklyHours !== 'object') return null
  const rawHours = data.weeklyHours as Record<string, unknown>
  if (Object.keys(rawHours).length !== BOOKING_DAY_KEYS.length) return null
  const weeklyHours = {} as Record<BookingDayKey, BookingDaySchedule>
  for (const day of BOOKING_DAY_KEYS) {
    const raw = rawHours[day]
    if (!raw || typeof raw !== 'object') return null
    const item = raw as Record<string, unknown>
    if (typeof item.enabled !== 'boolean' || typeof item.open !== 'string' || typeof item.close !== 'string') return null
    if (item.enabled && (!TIME_PATTERN.test(item.open) || !TIME_PATTERN.test(item.close) || Number(timeToMinutes(item.close)) <= Number(timeToMinutes(item.open)))) return null
    if (!item.enabled && (item.open !== '' || item.close !== '')) return null
    weeklyHours[day] = { enabled: item.enabled, open: item.open, close: item.close }
  }
  return {
    schemaVersion: BOOKING_SCHEDULE_SCHEMA_VERSION,
    timezone: BOOKING_TIMEZONE,
    slotIntervalMinutes: data.slotIntervalMinutes as BookingSchedule['slotIntervalMinutes'],
    minimumLeadMinutes: Number(data.minimumLeadMinutes),
    weeklyHours,
    closedDates: [...data.closedDates] as string[],
    active: data.active,
    version: Number(data.version),
    updatedAt: data.updatedAt ?? null,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  }
}

function zonedParts(epochMs: number, timezone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(epochMs))
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

export function zonedDateTimeToEpochMs(date: string, time: string, timezone = BOOKING_TIMEZONE): number | null {
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute, 0)
  let guess = target
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(guess, timezone)
    const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    guess += target - observed
  }
  return guess
}

export function dateInTimezone(epochMs: number, timezone = BOOKING_TIMEZONE): string {
  const parts = zonedParts(epochMs, timezone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function bookingDayForDate(date: string): BookingDayKey | null {
  if (!DATE_PATTERN.test(date)) return null
  const [year, month, day] = date.split('-').map(Number)
  return BOOKING_DAY_KEYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

export function buildBookingSlots(
  schedule: BookingSchedule,
  date: string,
  durationMinutes: number,
  nowMs = Date.now(),
): BookingSlot[] {
  if (!schedule.active || !Number.isSafeInteger(durationMinutes) || durationMinutes <= 0 || schedule.closedDates.includes(date)) return []
  const day = bookingDayForDate(date)
  if (!day) return []
  const hours = schedule.weeklyHours[day]
  if (!hours.enabled) return []
  const open = timeToMinutes(hours.open)
  const close = timeToMinutes(hours.close)
  if (open === null || close === null) return []
  const minimum = nowMs + schedule.minimumLeadMinutes * 60_000
  const result: BookingSlot[] = []
  for (let start = open; start + durationMinutes <= close; start += schedule.slotIntervalMinutes) {
    const startTime = minutesToTime(start)
    const endTime = minutesToTime(start + durationMinutes)
    const startsAt = zonedDateTimeToEpochMs(date, startTime, schedule.timezone)
    if (startsAt === null || startsAt < minimum) continue
    result.push({ start: startTime, end: endTime, label: `${startTime} · termina ${endTime}`, startsAt })
  }
  return result
}
