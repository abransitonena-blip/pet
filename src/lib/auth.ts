const SESSION_MAX_AGE = 86400 // 24h

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`
}

function removeCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

export function setSessionCookie(role?: string) {
  if (typeof document === 'undefined') return
  setCookie('__session', '1', SESSION_MAX_AGE)
  if (role) setCookie('__role', role, SESSION_MAX_AGE)
}

export function clearSessionCookie() {
  if (typeof document === 'undefined') return
  removeCookie('__session')
  removeCookie('__role')
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
