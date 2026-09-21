/**
 * Cuándo un teléfono necesita agregar la app a su pantalla de inicio para poder
 * recibir avisos.
 *
 * En iPhone y iPad, un sitio abierto en una pestaña de Safari NO puede recibir
 * avisos: sólo una app agregada a la pantalla de inicio, y sólo desde iOS 16.4.
 * Eso deja a la mayoría de los iPhone sin avisos sin que nada falle -- el botón
 * para activarlos ni siquiera aparece --, y el único rastro era un texto chico
 * dentro de otra tarjeta. Aquí se decide cuándo hay que enseñar el camino.
 *
 * Android y computadoras no lo necesitan: el navegador los admite tal cual.
 */

export interface DeviceInfo {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
  /** Ya corre como app instalada (abierta desde el ícono de la pantalla de inicio). */
  standalone: boolean
}

export type InstallAdvice =
  /** No hace falta enseñar nada: no es iOS, o ya está instalada. */
  | 'none'
  /** iOS en Safari: agregarla a la pantalla de inicio. */
  | 'add-to-home'
  /** iOS en otro navegador: abrirla primero en Safari. */
  | 'open-in-safari'

export function isIos(device: Pick<DeviceInfo, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  if (/iPhone|iPad|iPod/.test(device.userAgent)) return true
  // Desde iPadOS 13, el iPad se presenta como un Mac: lo delata la pantalla táctil.
  return device.platform === 'MacIntel' && (device.maxTouchPoints ?? 0) > 1
}

/** Navegadores de terceros en iOS: Chrome, Firefox, Edge, Opera y la app de Google. */
const NOT_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//

export function installAdvice(device: DeviceInfo): InstallAdvice {
  if (!isIos(device) || device.standalone) return 'none'
  return NOT_SAFARI.test(device.userAgent) ? 'open-in-safari' : 'add-to-home'
}

/** Lo que hay que leer del navegador, aislado para poder probarlo sin uno. */
export function readDevice(): DeviceInfo | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone,
  }
}
