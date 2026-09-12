/**
 * Qué se puede subir a la galería pública, y de qué tipo es cada cosa.
 *
 * La galería sólo aceptaba fotos quietas. Un paseo se cuenta mejor con tres
 * segundos de un perro corriendo que con una foto -- lo que en el iPhone se
 * llama "foto animada". Así que ahora entran también GIF animado y video corto
 * sin sonido, que es lo mismo que ve una persona pero pesa mucho menos.
 *
 * Cloudinary guarda el video bajo otro tipo de recurso (`video` en vez de
 * `image`), y eso cambia el URL de entrega. Por eso el tipo se decide aquí, en
 * un solo lugar, y no en cada pantalla que lo dibuja.
 */

export const GALLERY_STILL_FORMATS = ['jpg', 'jpeg', 'png', 'webp'] as const
/** Animado, pero sigue siendo un recurso de imagen en Cloudinary. */
export const GALLERY_ANIMATED_FORMATS = ['gif'] as const
export const GALLERY_VIDEO_FORMATS = ['mp4', 'webm'] as const

export type GalleryFormat =
  | (typeof GALLERY_STILL_FORMATS)[number]
  | (typeof GALLERY_ANIMATED_FORMATS)[number]
  | (typeof GALLERY_VIDEO_FORMATS)[number]

export const GALLERY_FORMATS: readonly GalleryFormat[] = [
  ...GALLERY_STILL_FORMATS,
  ...GALLERY_ANIMATED_FORMATS,
  ...GALLERY_VIDEO_FORMATS,
]

/** Lo que acepta el selector de archivos, por tipo MIME. */
export const GALLERY_UPLOAD_TYPES: readonly string[] = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm',
]

/**
 * Un video pesa órdenes de magnitud más que una foto, y esto lo ve cada persona
 * que abre la página desde su teléfono con datos. Tres segundos bastan.
 */
export const GALLERY_STILL_MAX_BYTES = 10_000_000
export const GALLERY_VIDEO_MAX_BYTES = 20_000_000
export const GALLERY_VIDEO_MAX_SECONDS = 20

export function isGalleryFormat(value: unknown): value is GalleryFormat {
  return typeof value === 'string' && (GALLERY_FORMATS as readonly string[]).includes(value)
}

export function isGalleryVideo(format: string): boolean {
  return (GALLERY_VIDEO_FORMATS as readonly string[]).includes(format)
}

/** Se mueve solo: video, o GIF animado. Cambia cómo se dibuja, no dónde vive. */
export function isGalleryAnimated(format: string): boolean {
  return isGalleryVideo(format) || (GALLERY_ANIMATED_FORMATS as readonly string[]).includes(format)
}

/** El tipo de recurso de Cloudinary, que decide el endpoint y el URL. */
export function galleryResourceKind(format: string): 'image' | 'video' {
  return isGalleryVideo(format) ? 'video' : 'image'
}

export function galleryResourceKindForMime(mime: string): 'image' | 'video' {
  return mime.startsWith('video/') ? 'video' : 'image'
}

export function galleryMaxBytesForMime(mime: string): number {
  return galleryResourceKindForMime(mime) === 'video' ? GALLERY_VIDEO_MAX_BYTES : GALLERY_STILL_MAX_BYTES
}

export function galleryUploadHelpText(): string {
  return `JPG, PNG, WebP o GIF de máximo ${GALLERY_STILL_MAX_BYTES / 1_000_000} MB, o video MP4/WebM de máximo ${GALLERY_VIDEO_MAX_BYTES / 1_000_000} MB y ${GALLERY_VIDEO_MAX_SECONDS} segundos. El video se ve sin sonido y en bucle.`
}
