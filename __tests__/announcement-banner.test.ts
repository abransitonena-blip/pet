import { readFileSync } from 'node:fs'

describe('announcement banner', () => {
  const banner = readFileSync('src/components/AnnouncementBanner.tsx', 'utf8')
  const home = readFileSync('src/app/HomeClient.tsx', 'utf8')
  const familyLayout = readFileSync('src/app/familia/FamilyLayoutClient.tsx', 'utf8')

  test('is mounted on the public landing page and the Familia dashboard', () => {
    expect(home).toContain('<AnnouncementBanner')
    expect(familyLayout).toContain('<AnnouncementBanner')
  })

  test('reads announcements from site config, not a separate write path', () => {
    expect(banner).toContain('getActiveAnnouncements(config.announcements)')
  })

  test('dismissal is a client-only localStorage flag, never a Firestore write', () => {
    expect(banner).toContain('window.localStorage.setItem')
    expect(banner).not.toMatch(/setDoc|updateDoc|addDoc/)
  })

  test('never shows a stale dismissal before localStorage is checked', () => {
    expect(banner).toContain('hydrated')
    expect(banner).toContain('if (!hydrated')
  })
})
