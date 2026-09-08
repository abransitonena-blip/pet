import { readFileSync } from 'node:fs'

describe('FAQ search on the Familia help center', () => {
  const page = readFileSync('src/app/familia/ayuda/page.tsx', 'utf8')

  test('filters by matching question or answer text, case-insensitively', () => {
    expect(page).toContain('toLowerCase().includes(normalizedSearch)')
    expect(page).toContain('item.q.toLowerCase()')
    expect(page).toContain('item.a.toLowerCase()')
  })

  test('drops empty sections instead of rendering an empty category heading', () => {
    expect(page).toContain('.filter((section) => section.questions.length > 0)')
  })

  test('shows a no-results message rather than a silent blank page', () => {
    expect(page).toContain('Sin resultados para')
  })
})

describe('analytics events for the new features', () => {
  const analytics = readFileSync('src/lib/analytics.ts', 'utf8')
  const banner = readFileSync('src/components/AnnouncementBanner.tsx', 'utf8')
  const widget = readFileSync('src/components/family/FeedbackWidget.tsx', 'utf8')

  test('every custom event routes through the consent-gated safeGtag wrapper', () => {
    expect(analytics).toContain('announcementDismissed')
    expect(analytics).toContain('feedbackSubmitted')
  })

  test('the banner tracks a dismissal, the widget tracks a successful submit', () => {
    expect(banner).toContain('Events.announcementDismissed(id)')
    expect(widget).toContain('Events.feedbackSubmitted(category)')
  })
})
