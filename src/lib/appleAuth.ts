import { OAuthProvider } from 'firebase/auth'

/**
 * Acceso con Apple.
 *
 * Firebase guarda del lado del servidor lo que Apple pide (Services ID, Team ID,
 * Key ID y la llave privada), así que aquí no viaja ningún secreto: sólo el
 * proveedor y los permisos que se le piden a Apple.
 *
 * El botón no se muestra hasta que `NEXT_PUBLIC_APPLE_AUTH_ENABLED` vale '1'.
 * Esa variable es el interruptor de "ya terminé el trámite con Apple": mientras
 * falte el Services ID o la llave en la consola de Firebase, el acceso falla con
 * un error de Apple, y es mejor no ofrecerle a una familia un botón que truena.
 * Encender el proveedor en Firebase no basta -- su palomita verde no comprueba
 * que la configuración esté completa.
 */

export const appleAuthProvider = new OAuthProvider('apple.com')
// Apple sólo entrega el nombre y el correo la primera vez que alguien acepta.
appleAuthProvider.addScope('email')
appleAuthProvider.addScope('name')

export function isAppleAuthConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED ?? '').trim() === '1'
}

/**
 * Qué decirle a la persona cuando Apple o Firebase rechazan el acceso.
 *
 * Los dos primeros casos son de configuración, no de la persona: aparecen
 * mientras falte algo del trámite con Apple. Se distinguen a propósito, para no
 * mandar a una familia a revisar su internet cuando el problema es nuestro.
 */
export function appleLoginErrorMessage(code: string): string {
  if (code === 'auth/operation-not-allowed') {
    // Firebase responde esto tanto si el proveedor está apagado como si está
    // encendido pero sin Services ID ni llave: para quien mira la consola, la
    // palomita verde hace parecer que ya está listo.
    return 'El acceso con Apple todavía no está configurado del todo. Usa Google o tu correo, y avísale a administración.'
  }
  if (code === 'auth/invalid-credential' || code === 'auth/internal-error') {
    return 'El acceso con Apple todavía no está configurado del todo. Usa Google o tu correo, y avísale a administración.'
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Este sitio no está autorizado para el acceso con Apple. Avísale a administración.'
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'Ya tienes una cuenta con ese correo. Entra como lo hiciste la primera vez (Google o correo y contraseña).'
  }
  if (code === 'auth/popup-blocked') {
    return 'Tu navegador bloqueó la ventana de Apple. Permite las ventanas emergentes e inténtalo de nuevo.'
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return ''
  }
  if (code === 'auth/network-request-failed') {
    return 'No pudimos contactar a Apple. Revisa tu conexión e inténtalo de nuevo.'
  }
  return 'No pudimos completar el acceso con Apple. Intenta de nuevo o usa tu correo.'
}
