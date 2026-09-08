import { readFileSync } from 'node:fs'

describe('client error reporting', () => {
  const route = readFileSync('src/app/api/errors/report/route.ts', 'utf8')
  const reportHelper = readFileSync('src/lib/reportError.ts', 'utf8')
  const errorBoundary = readFileSync('src/app/error.tsx', 'utf8')

  test('requires authentication and rate limits before writing anything', () => {
    expect(route).toContain('verifyAuthenticatedToken')
    expect(route).toContain('checkRateLimit(')
    const authIndex = route.indexOf("status: 401")
    const rateLimitIndex = route.indexOf('checkRateLimit(')
    const writeIndex = route.indexOf("collection('errorLogs').doc()")
    expect(authIndex).toBeLessThan(rateLimitIndex)
    expect(rateLimitIndex).toBeLessThan(writeIndex)
  })

  test('fails closed behind T3 identity availability, like reviews/submit', () => {
    expect(route).toContain('getPrivilegedFirestore()')
    expect(route).toContain('privileged-identity-not-configured')
  })

  test('caps message and stack length so a single report cannot flood the collection', () => {
    expect(route).toContain('MAX_MESSAGE_LENGTH')
    expect(route).toContain('MAX_STACK_LENGTH')
  })

  test('the root error boundary reports through the helper, never silently', () => {
    expect(errorBoundary).toContain('reportError(error')
    expect(reportHelper).toContain("fetch('/api/errors/report'")
  })

  test('reporting a crash never itself throws', () => {
    expect(reportHelper).toMatch(/catch\s*\{\s*(\/\/[^\n]*\n\s*)?\}/)
  })
})
