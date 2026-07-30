export function setSessionCookie() {
  if (typeof document === 'undefined') return
  document.cookie = '__session=1; path=/; max-age=86400; SameSite=Lax; Secure'
}

export function clearSessionCookie() {
  if (typeof document === 'undefined') return
  document.cookie = '__session=; path=/; max-age=0'
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
