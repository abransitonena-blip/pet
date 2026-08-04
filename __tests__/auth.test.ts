import {
  isWebView,
  classifyGoogleError,
  GOOGLE_ERROR_MESSAGES,
  classifyLoginError,
  LOGIN_ERROR_MESSAGES,
  RESET_LINK_SENT_MESSAGE,
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

describe('classifyLoginError', () => {
  it('differentiates known auth error codes', () => {
    const tests: [string, string][] = [
      ['auth/invalid-email', LOGIN_ERROR_MESSAGES['auth/invalid-email']],
      ['auth/user-not-found', LOGIN_ERROR_MESSAGES['auth/user-not-found']],
      ['auth/wrong-password', LOGIN_ERROR_MESSAGES['auth/wrong-password']],
      ['auth/invalid-credential', LOGIN_ERROR_MESSAGES['auth/invalid-credential']],
      ['auth/user-disabled', LOGIN_ERROR_MESSAGES['auth/user-disabled']],
      ['auth/too-many-requests', LOGIN_ERROR_MESSAGES['auth/too-many-requests']],
      ['auth/network-request-failed', LOGIN_ERROR_MESSAGES['auth/network-request-failed']],
    ]
    for (const [code, expected] of tests) {
      expect(classifyLoginError({ code })).toBe(expected)
    }
  })

  it('does not lump user-not-found and wrong-password together', () => {
    expect(classifyLoginError({ code: 'auth/user-not-found' })).toBe(
      'No encontramos una cuenta con este correo'
    )
    expect(classifyLoginError({ code: 'auth/wrong-password' })).toBe(
      'Contraseña incorrecta'
    )
  })

  it('returns fallback for unknown error code', () => {
    expect(classifyLoginError({ code: 'auth/unknown-thing' })).toBe(
      'Error al iniciar sesión. Inténtalo de nuevo.'
    )
  })

  it('returns fallback for non-object error', () => {
    expect(classifyLoginError(null)).toBe('Error al iniciar sesión. Inténtalo de nuevo.')
    expect(classifyLoginError(undefined)).toBe('Error al iniciar sesión. Inténtalo de nuevo.')
    expect(classifyLoginError('oops')).toBe('Error al iniciar sesión. Inténtalo de nuevo.')
  })
})

describe('RESET_LINK_SENT_MESSAGE', () => {
  it('never reveals whether the account exists', () => {
    expect(RESET_LINK_SENT_MESSAGE).not.toContain('no existe')
    expect(RESET_LINK_SENT_MESSAGE).not.toContain('no registrado')
    expect(RESET_LINK_SENT_MESSAGE).toContain('Si el correo está registrado')
  })
})
