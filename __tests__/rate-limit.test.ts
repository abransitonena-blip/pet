import { checkRateLimit } from '@/lib/rateLimit'

describe('checkRateLimit', () => {
  test('allows requests up to the limit, then blocks within the same window', () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    }
    const blocked = checkRateLimit(key, 3, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  test('tracks separate keys independently', () => {
    const a = `test-a-${Math.random()}`
    const b = `test-b-${Math.random()}`
    for (let i = 0; i < 3; i += 1) checkRateLimit(a, 3, 60_000)
    expect(checkRateLimit(a, 3, 60_000).allowed).toBe(false)
    expect(checkRateLimit(b, 3, 60_000).allowed).toBe(true)
  })

  test('resets after the window elapses', () => {
    const key = `test-reset-${Math.random()}`
    expect(checkRateLimit(key, 1, 10).allowed).toBe(true)
    expect(checkRateLimit(key, 1, 10).allowed).toBe(false)
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(checkRateLimit(key, 1, 10).allowed).toBe(true)
        resolve()
      }, 30)
    })
  })
})
