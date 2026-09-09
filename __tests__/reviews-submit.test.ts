import { readFileSync } from 'node:fs'

describe('reviews: open submissions by explicit product decision, kept honest by auth + rate limit', () => {
  const route = readFileSync('src/app/api/reviews/submit/route.ts', 'utf8')
  const form = readFileSync('src/components/ReviewForm.tsx', 'utf8')
  const display = readFileSync('src/components/Reviews.tsx', 'utf8')

  test('requires authentication and rate limits before writing, in that order', () => {
    expect(route).toContain('verifyAuthenticatedToken')
    expect(route).toContain('checkRateLimit(')
    const authIndex = route.indexOf('status: 401')
    const rateLimitIndex = route.indexOf('checkRateLimit(')
    const writeIndex = route.indexOf("collection('reviews').doc()")
    expect(authIndex).toBeLessThan(rateLimitIndex)
    expect(rateLimitIndex).toBeLessThan(writeIndex)
  })

  test('does not check walk completion history: DR-09 eligibility was intentionally removed', () => {
    expect(route).not.toContain('walkSessions')
    expect(route).not.toContain('not-eligible')
  })

  test('fails closed behind PUBLIC_REVIEWS_ENABLED and T3 identity availability', () => {
    expect(route).toContain('FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED')
    expect(route).toContain('getPrivilegedFirestore()')
  })

  test('the client submits through the verified endpoint instead of writing reviews directly', () => {
    expect(form).toContain("fetch('/api/reviews/submit'")
    expect(form).not.toContain("addDoc(collection(db, 'reviews')")
  })

  test('the public display query matches what the write path actually sets: no dangling moderation filter', () => {
    expect(display).not.toContain("where('verified'")
    expect(display).not.toContain("where('moderationStatus'")
    expect(display).toContain("orderBy('date', 'desc')")
  })
})
