import {
  BOOKING_TIMEZONE,
  buildBookingSlots,
  createEmptyBookingSchedule,
  parseBookingSchedule,
  parseServiceDurationMinutes,
} from '@/lib/bookingSchedule'

function activeSchedule() {
  const schedule = createEmptyBookingSchedule()
  return {
    ...schedule,
    active: true,
    version: 1,
    minimumLeadMinutes: 60,
    weeklyHours: {
      ...schedule.weeklyHours,
      lunes: { enabled: true, open: '08:00', close: '10:00' },
    },
  }
}

describe('R1 fixed booking slots', () => {
  test('uses Mexico City, 15-minute steps and derives the end from service duration', () => {
    const schedule = activeSchedule()
    const slots = buildBookingSlots(schedule, '2026-08-31', 60, Date.UTC(2026, 7, 30))
    expect(schedule.timezone).toBe(BOOKING_TIMEZONE)
    expect(slots.map((slot) => [slot.start, slot.end])).toEqual([
      ['08:00', '09:00'], ['08:15', '09:15'], ['08:30', '09:30'], ['08:45', '09:45'], ['09:00', '10:00'],
    ])
  })

  test('excludes elapsed slots and closed dates without claiming availability', () => {
    const schedule = activeSchedule()
    expect(buildBookingSlots(schedule, '2026-08-31', 60, Date.UTC(2026, 7, 31, 14, 0)).map((slot) => slot.start)).toEqual(['09:00'])
    expect(buildBookingSlots({ ...schedule, closedDates: ['2026-08-31'] }, '2026-08-31', 60, 0)).toEqual([])
  })

  test('fails closed for missing configuration, disabled days and services without duration', () => {
    expect(parseBookingSchedule(createEmptyBookingSchedule())).toBeNull()
    expect(buildBookingSlots({ ...activeSchedule(), active: false }, '2026-08-31', 60, 0)).toEqual([])
    expect(buildBookingSlots(activeSchedule(), '2026-08-30', 60, 0)).toEqual([])
    expect(buildBookingSlots(activeSchedule(), '2026-08-31', 0, 0)).toEqual([])
    expect(parseServiceDurationMinutes('30 min')).toBe(30)
    expect(parseServiceDurationMinutes('1 hora')).toBe(60)
    expect(parseServiceDurationMinutes('6 paseos')).toBeNull()
  })
})
