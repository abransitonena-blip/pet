/**
 * La foto del perro: un asset privado, igual que las fotos de un paseo.
 *
 * El expediente de un perro trae su casa, su rutina y su veterinario, así que su
 * foto no se guarda en un URL público: se sube como asset `authenticated`, la
 * referencia que queda en el documento es un id opaco, y para verla hay que
 * pedir un enlace que caduca. Mientras no haya foto, `DogAvatar` pinta la marca
 * teñida del perro.
 */

export const DOG_PHOTO_FOLDER = 'pet-ap-private/dogs'

const DOG_PHOTO_REFERENCE = /^pet-ap-private\/dogs\/[a-f0-9-]{36}$/

/** Un id opaco bajo el prefijo de perros -- nunca un URL. */
export function isDogPhotoReference(value: unknown): value is string {
  return typeof value === 'string' && DOG_PHOTO_REFERENCE.test(value)
}

export const DOG_PHOTO_MAX_BYTES = 10_000_000
export const DOG_PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']

/** Cuántos perros puede pedir una lista de un jalón. */
export const MAX_DOG_PHOTO_LOOKUPS = 20

export function dogPhotoErrorMessage(code: string): string {
  if (code === 'photos-disabled' || code === 'private-media-uploads-not-enabled') {
    return 'Las fotos están desactivadas por ahora.'
  }
  if (code === 'photo-invalid') return 'Usa una foto JPG, PNG o WebP de máximo 10 MB.'
  if (code === 'dog-not-yours') return 'Ese perro no está en tu cuenta.'
  if (code === 'signed-upload-not-configured' || code === 'privileged-identity-not-configured') {
    return 'La carga de fotos no está configurada en este entorno.'
  }
  if (code.startsWith('cloudinary:') && /missing permissions/i.test(code)) {
    return 'Cloudinary rechazó la foto: la llave configurada no tiene permiso para crear archivos. Avísale a administración.'
  }
  if (code.startsWith('cloudinary:')) return `Cloudinary rechazó la foto: ${code.slice('cloudinary:'.length)}`
  return 'No pudimos subir la foto. Revisa tu conexión e inténtalo de nuevo.'
}
