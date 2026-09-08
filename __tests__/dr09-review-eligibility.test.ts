import { readFileSync } from 'node:fs'

describe('DR-09 closed: reviews require a real completed walk, not just a shape check', () => {
  const route = readFileSync('src/app/api/reviews/submit/route.ts', 'utf8')
  const form = readFileSync('src/components/ReviewForm.tsx', 'utf8')
  const rulesFragment = readFileSync('artifacts/rules/reviews-server-only.fragment.rules', 'utf8')

  test('checks the canonical walkSessions collection, never legacy reservations', () => {
    expect(route).toContain("collection('walkSessions')")
    expect(route).toContain("where('customerId', '==', uid)")
    expect(route).toContain("where('status', '==', 'completed')")
    expect(route).not.toContain("collection('reservations')")
  })

  test('rejects with 403 when there is no completed session, before writing anything', () => {
    expect(route).toContain('completedSessions.empty')
    expect(route).toContain("status: 403")
    const emptyCheckIndex = route.indexOf('completedSessions.empty')
    const writeIndex = route.indexOf("collection('reviews').doc()")
    expect(emptyCheckIndex).toBeLessThan(writeIndex)
  })

  test('fails closed behind PUBLIC_REVIEWS_ENABLED and T3 identity availability', () => {
    expect(route).toContain('FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED')
    expect(route).toContain('getPrivilegedFirestore()')
  })

  test('requires authentication before anything else', () => {
    expect(route.indexOf("status: 401")).toBeLessThan(route.indexOf('FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED'))
  })

  test('the client submits through the verified endpoint instead of writing reviews directly', () => {
    expect(form).toContain("fetch('/api/reviews/submit'")
    expect(form).not.toContain("addDoc(collection(db, 'reviews')")
    expect(form).toContain('not-eligible')
  })

  test('a prepared (not deployed) rules fragment closes the client create path once this ships', () => {
    expect(rulesFragment).toContain('Do not deploy this file by itself')
    expect(rulesFragment).toContain('allow create: if false')
  })

  test('rate limits per uid before checking the flag or eligibility, after authentication', () => {
    expect(route).toContain('checkRateLimit(')
    expect(route).toContain("status: 429")
    const authIndex = route.indexOf("status: 401")
    const rateLimitIndex = route.indexOf('checkRateLimit(')
    const flagIndex = route.indexOf('FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED')
    expect(authIndex).toBeLessThan(rateLimitIndex)
    expect(rateLimitIndex).toBeLessThan(flagIndex)
  })
})
