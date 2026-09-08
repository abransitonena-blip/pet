import { getActiveAnnouncements, mexicanObservanceShortcuts } from '@/lib/announcements'
import type { Announcement } from '@/lib/defaultConfig'

function announcement(overrides: Partial<Announcement>): Announcement {
  return {
    id: 'a1', title: 'Título', message: 'Mensaje', icon: '🎉',
    startDate: '2026-01-01', endDate: '2026-01-01', active: true,
    ...overrides,
  }
}

describe('getActiveAnnouncements', () => {
  const now = new Date('2026-08-26T12:00:00Z')

  test('includes an announcement whose range contains today', () => {
    const items = [announcement({ startDate: '2026-08-20', endDate: '2026-08-31' })]
    expect(getActiveAnnouncements(items, now)).toHaveLength(1)
  })

  test('excludes an inactive announcement even if the date matches', () => {
    const items = [announcement({ active: false, startDate: '2026-08-20', endDate: '2026-08-31' })]
    expect(getActiveAnnouncements(items, now)).toHaveLength(0)
  })

  test('excludes an announcement outside its date range on both sides', () => {
    const items = [
      announcement({ id: 'past', startDate: '2026-01-01', endDate: '2026-01-31' }),
      announcement({ id: 'future', startDate: '2026-12-01', endDate: '2026-12-31' }),
    ]
    expect(getActiveAnnouncements(items, now)).toHaveLength(0)
  })

  test('is inclusive on both boundary days', () => {
    const items = [announcement({ startDate: '2026-08-26', endDate: '2026-08-26' })]
    expect(getActiveAnnouncements(items, now)).toHaveLength(1)
  })
})

describe('mexicanObservanceShortcuts', () => {
  test('computes the Mexican Día del Perro as the third Sunday of July', () => {
    const shortcuts = mexicanObservanceShortcuts(2026)
    const dogDay = shortcuts.find((item) => item.label.startsWith('Día del Perro'))
    expect(dogDay).toBeDefined()
    const date = new Date(`${dogDay!.startDate}T12:00:00Z`)
    expect(date.getUTCDay()).toBe(0) // Sunday
    expect(date.getUTCMonth()).toBe(6) // July
    // Third Sunday: at least the 15th, at most the 21st.
    expect(date.getUTCDate()).toBeGreaterThanOrEqual(15)
    expect(date.getUTCDate()).toBeLessThanOrEqual(21)
  })

  test('every shortcut has a well-formed, non-inverted date range', () => {
    for (const shortcut of mexicanObservanceShortcuts(2026)) {
      expect(shortcut.startDate <= shortcut.endDate).toBe(true)
      expect(shortcut.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
