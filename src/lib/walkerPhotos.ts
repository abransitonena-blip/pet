/**
 * La foto del paseador: quién toca la puerta.
 *
 * Una familia entrega a su perro a alguien que no conoce. Ver su cara antes de
 * abrir no es un adorno del perfil: es lo que convierte a "el paseador asignado"
 * en una persona reconocible.
 *
 * Se guarda como asset privado, igual que la del perro: el documento del
 * paseador guarda sólo una referencia opaca, y para verla hay que pedir un
 * enlace que caduca. La familia no la pide por paseador -- la pide por su propio
 * paseo, y el servidor decide.
 */

export const WALKER_PHOTO_FOLDER = 'pet-ap-private/walkers'

const WALKER_PHOTO_REFERENCE = /^pet-ap-private\/walkers\/[a-f0-9-]{36}$/

export function isWalkerPhotoReference(value: unknown): value is string {
  return typeof value === 'string' && WALKER_PHOTO_REFERENCE.test(value)
}

export const WALKER_PHOTO_MAX_BYTES = 10_000_000
export const WALKER_PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']

export function walkerPhotoErrorMessage(code: string): string {
  if (code === 'photos-disabled' || code === 'private-media-uploads-not-enabled') {
    return 'Las fotos están desactivadas por ahora.'
  }
  if (code === 'photo-invalid') return 'Usa una foto JPG, PNG o WebP de máximo 10 MB.'
  if (code === 'walker-required' || code === 'walker-not-active') {
    return 'Tu cuenta de paseador no está activa. Avísale a administración.'
  }
  if (code === 'signed-upload-not-configured' || code === 'privileged-identity-not-configured') {
    return 'La carga de fotos no está configurada en este entorno.'
  }
  if (code.startsWith('cloudinary:') && /missing permissions/i.test(code)) {
    return 'Cloudinary rechazó la foto: la llave configurada no tiene permiso para crear archivos. Avísale a administración.'
  }
  if (code.startsWith('cloudinary:')) return `Cloudinary rechazó la foto: ${code.slice('cloudinary:'.length)}`
  return 'No pudimos subir tu foto. Revisa tu conexión e inténtalo de nuevo.'
}
