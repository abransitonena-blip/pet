import { requiredEnv } from '../src/lib/env'

describe('requiredEnv', () => {
  it('returns trimmed value for valid string', () => {
    expect(requiredEnv('hello', 'TEST')).toBe('hello')
  })

  it('trims whitespace', () => {
    expect(requiredEnv('  hello  ', 'TEST')).toBe('hello')
  })

  it('throws when undefined', () => {
    expect(() => requiredEnv(undefined, 'TEST')).toThrow(
      'Missing required environment variable: TEST'
    )
  })

  it('throws when empty string', () => {
    expect(() => requiredEnv('', 'TEST')).toThrow(
      'Missing required environment variable: TEST'
    )
  })

  it('throws when only whitespace', () => {
    expect(() => requiredEnv('   ', 'TEST')).toThrow(
      'Missing required environment variable: TEST'
    )
  })
})
