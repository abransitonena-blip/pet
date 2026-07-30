import {
  isWebView,
  classifyGoogleError,
  GOOGLE_ERROR_MESSAGES,
} from '../src/lib/auth'

describe('isWebView', () => {
  const originalUserAgent = navigator.userAgent

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    })
  })

  it('returns false for Chrome desktop', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
    })
    expect(isWebView()).toBe(false)
  })

  it('returns false for Safari desktop', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      configurable: true,
    })
    expect(isWebView()).toBe(false)
  })

  it('returns true for Instagram in-app browser', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram/123.0.0.0.0 Mobile/15E148',
      configurable: true,
    })
    expect(isWebView()).toBe(true)
  })

  it('returns true for Facebook in-app browser', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.128 Mobile Safari/537.36 [FB_IAB/FB4A]',
      configurable: true,
    })
    expect(isWebView()).toBe(true)
  })

  it('returns true for generic WebView without Chrome', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) WebView/108.0.0.0 Mobile Safari/537.36',
      configurable: true,
    })
    expect(isWebView()).toBe(true)
  })

  it('returns false for Chrome on Android (not WebView)', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
      configurable: true,
    })
    expect(isWebView()).toBe(false)
  })

  it('returns false when navigator is undefined', () => {
    expect(isWebView()).toBe(false)
  })
})

describe('classifyGoogleError', () => {
  it('returns message for known error codes', () => {
    const tests: [string, string][] = [
      ['auth/popup-blocked', GOOGLE_ERROR_MESSAGES['auth/popup-blocked']],
      ['auth/network-request-failed', GOOGLE_ERROR_MESSAGES['auth/network-request-failed']],
      ['auth/invalid-api-key', GOOGLE_ERROR_MESSAGES['auth/invalid-api-key']],
      ['auth/unauthorized-domain', GOOGLE_ERROR_MESSAGES['auth/unauthorized-domain']],
    ]
    for (const [code, expected] of tests) {
      expect(classifyGoogleError({ code })).toBe(expected)
    }
  })

  it('returns fallback for unknown error code', () => {
    const result = classifyGoogleError({ code: 'auth/unknown-error' })
    expect(result).toBe(
      'No pudimos iniciar sesión con Google. Puedes reintentar o usar correo.'
    )
  })

  it('returns fallback for non-object error', () => {
    expect(classifyGoogleError(null)).toBe(
      'No pudimos iniciar sesión con Google. Puedes reintentar o usar correo.'
    )
    expect(classifyGoogleError('string error')).toBe(
      'No pudimos iniciar sesión con Google. Puedes reintentar o usar correo.'
    )
    expect(classifyGoogleError(undefined)).toBe(
      'No pudimos iniciar sesión con Google. Puedes reintentar o usar correo.'
    )
  })
})
