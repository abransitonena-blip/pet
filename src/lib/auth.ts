import { entryForPrivatePath, isSafeRedirect } from '@/lib/roles'

// 30 días. Se renueva en cada carga con sesión activa (SessionCookieKeeper),
// así que la persona solo vuelve a entrar cuando cierra sesión de verdad.
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`
}

function removeCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

// Sets only the session-presence flag. Authorization is decided by the ID
// token custom claims, never by this cookie (P0.8).
export function setSessionCookie() {
  if (typeof document === 'undefined') return
  setCookie('__session', '1', SESSION_MAX_AGE)
}

export function clearSessionCookie() {
  if (typeof document === 'undefined') return
  removeCookie('__session')
}

export function loginPathWithRedirect(pathname: string): string {
  return isSafeRedirect(pathname) ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login'
}

export function accessPathWithRedirect(pathname: string): string {
  const entry = entryForPrivatePath(pathname)
  return isSafeRedirect(pathname) ? `${entry}?redirect=${encodeURIComponent(pathname)}` : entry
}

export function isWebView(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  if (/(instagram|fb_iab|fbav|fban|fbrs|gmass|outlook|line|kakaotalk|snapchat)[/\s]/.test(ua)) return true
  if (/wv|webview/.test(ua) && !/chrome\/\d+/.test(ua)) return true
  return false
}

export const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google.',
  'auth/popup-closed-by-user': 'Cerraste la ventana antes de terminar.',
  'auth/unauthorized-domain': 'Este dominio todavía no está autorizado.',
  'auth/account-exists-with-different-credential': 'Ya existe una cuenta con este correo usando otro método.',
  'auth/network-request-failed': 'No pudimos conectarnos con Google. Revisa tu conexión.',
  'auth/operation-not-allowed': 'El acceso con Google no está habilitado.',
  'auth/invalid-api-key': 'La configuración de autenticación no es válida.',
  'auth/invalid-credential': 'Firebase Authentication no pudo validar la credencial de Google.',
  'auth/internal-error': 'Firebase Authentication no pudo completar el acceso. Intenta nuevamente.',
  'auth/user-disabled': 'Esta cuenta fue desactivada.',
  'auth/admin-restricted-operation': 'El acceso con Google no está habilitado.',
  'auth/credential-already-in-use': 'Esta cuenta ya está vinculada a otro usuario.',
}

export function classifyGoogleError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code: string }).code
    : 'unknown'
  const message = GOOGLE_ERROR_MESSAGES[code]
  if (message) return message
  return 'No pudimos iniciar sesión con Google. Puedes reintentar o usar correo.'
}

export type FamilyLoginStage = 'oauth' | 'auth' | 'claims' | 'profile'

export class FamilyLoginFlowError extends Error {
  readonly kind = 'family-login-flow-error'
  readonly stage: FamilyLoginStage
  readonly providerCode: string

  constructor(stage: FamilyLoginStage, cause: unknown) {
    super('family-login-flow-error')
    this.name = 'FamilyLoginFlowError'
    this.stage = stage
    this.providerCode = cause && typeof cause === 'object' && 'code' in cause
      ? String((cause as { code?: unknown }).code ?? '')
      : ''
  }
}

export function isFamilyLoginFlowError(error: unknown): error is FamilyLoginFlowError {
  return !!error
    && typeof error === 'object'
    && 'kind' in error
    && error.kind === 'family-login-flow-error'
    && 'stage' in error
    && ['oauth', 'auth', 'claims', 'profile'].includes(String(error.stage))
    && 'providerCode' in error
}

export function familyLoginError(stage: FamilyLoginStage, cause: unknown): FamilyLoginFlowError {
  return isFamilyLoginFlowError(cause) ? cause : new FamilyLoginFlowError(stage, cause)
}

export function classifyFamilyLoginError(error: unknown): string {
  if (!isFamilyLoginFlowError(error)) return classifyGoogleError(error)

  const code = error.providerCode.toLowerCase()
  if (code.includes('permission-denied')) {
    return 'Tu cuenta fue autenticada, pero no pudimos preparar tu perfil por permisos. Intenta nuevamente o solicita ayuda.'
  }
  if (code.includes('network-request-failed') || code === 'firestore/unavailable' || code === 'firestore/deadline-exceeded') {
    return error.stage === 'profile'
      ? 'Tu cuenta fue autenticada, pero no pudimos completar tu perfil por un problema de red. Intenta nuevamente.'
      : 'No pudimos verificar tu acceso por un problema de red. Intenta nuevamente.'
  }
  if (error.stage === 'claims') {
    return 'Tu cuenta fue autenticada, pero no pudimos verificar el tipo de acceso. Intenta nuevamente.'
  }
  if (error.stage === 'profile') {
    return 'Tu cuenta fue autenticada, pero no pudimos completar tu perfil de Familia PET. Intenta nuevamente.'
  }
  if (error.stage === 'auth') {
    return 'Google respondió, pero Firebase Authentication no pudo completar el acceso. Intenta nuevamente.'
  }
  return classifyGoogleError({ code: error.providerCode })
}

export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Correo inválido',
  'auth/user-not-found': 'No encontramos una cuenta con este correo',
  'auth/wrong-password': 'Contraseña incorrecta',
  'auth/invalid-credential': 'Contraseña incorrecta',
  'auth/user-disabled': 'Esta cuenta fue desactivada',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.',
  'auth/network-request-failed': 'Error de red. Verifica tu conexión e intenta de nuevo.',
  'auth/operation-not-allowed': 'El acceso por correo no está habilitado.',
  'auth/admin-restricted-operation': 'El acceso por correo no está habilitado.',
}

export function classifyLoginError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code: string }).code
    : 'unknown'
  const message = LOGIN_ERROR_MESSAGES[code]
  if (message) return message
  return 'Error al iniciar sesión. Inténtalo de nuevo.'
}

export const RESET_LINK_SENT_MESSAGE =
  'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
