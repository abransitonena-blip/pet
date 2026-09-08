import { readFileSync } from 'node:fs'

describe('private customer feedback', () => {
  const route = readFileSync('src/app/api/feedback/submit/route.ts', 'utf8')
  const widget = readFileSync('src/components/family/FeedbackWidget.tsx', 'utf8')

  test('requires authentication and rate limits before writing anything', () => {
    expect(route).toContain('verifyAuthenticatedToken')
    expect(route).toContain('checkRateLimit(')
    const authIndex = route.indexOf('status: 401')
    const rateLimitIndex = route.indexOf('checkRateLimit(')
    const writeIndex = route.indexOf("collection('feedback').doc()")
    expect(authIndex).toBeLessThan(rateLimitIndex)
    expect(rateLimitIndex).toBeLessThan(writeIndex)
  })

  test('is distinct from public reviews: no eligibility check, never published', () => {
    expect(route).not.toContain('walkSessions')
    expect(route).not.toContain('not-eligible')
  })

  test('the widget submits through the endpoint, never writes Firestore directly', () => {
    expect(widget).toContain("fetch('/api/feedback/submit'")
    expect(widget).not.toMatch(/setDoc|addDoc|updateDoc/)
  })
})
