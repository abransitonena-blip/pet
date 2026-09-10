'use client'

import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { isWalkPhotoReference } from '@/lib/walkReports'

/**
 * Sube una foto del paseo como asset privado.
 *
 * The server signs an upload for this exact session after checking the walker
 * is assigned to it (/api/media/private/signature); the browser then sends the
 * file straight to Cloudinary, so Vercel's request-size limit never applies.
 * The asset is `type=authenticated`: its plain URL shows nothing, and every view
 * goes through /api/media/private/walk-photos, which hands out links that expire.
 */

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 10_000_000

export async function uploadWalkPhoto(sessionId: string, file: File): Promise<string> {
  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) throw new Error('photos-disabled')
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) throw new Error('photo-invalid')

  const { auth } = await import('@/firebase/config')
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('auth-required')

  const signedResponse = await fetch('/api/media/private/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ folder: 'pet-ap-private/walk-reports', sessionId }),
  })
  const signed = await signedResponse.json().catch(() => ({})) as Record<string, unknown>
  if (!signedResponse.ok) throw new Error(String(signed.code ?? 'signature-failed'))

  const body = new FormData()
  body.set('file', file)
  body.set('api_key', String(signed.apiKey))
  body.set('timestamp', String(signed.timestamp))
  body.set('signature', String(signed.signature))
  body.set('public_id', String(signed.publicId))
  body.set('type', String(signed.type))
  body.set('transformation', String(signed.transformation))
  body.set('overwrite', 'false')

  const upload = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(String(signed.cloudName))}/image/upload`, {
    method: 'POST',
    body,
  })
  const result = await upload.json().catch(() => ({})) as { public_id?: unknown; error?: { message?: unknown } }
  if (!upload.ok) {
    const detail = result.error?.message
    throw new Error(`cloudinary:${typeof detail === 'string' ? detail : `HTTP ${upload.status}`}`)
  }
  if (typeof result.public_id !== 'string' || !isWalkPhotoReference(result.public_id)) {
    throw new Error('upload-rejected-shape')
  }
  return result.public_id
}

export function walkPhotoErrorMessage(code: string): string {
  if (code === 'photos-disabled') return 'Las fotos del paseo están desactivadas.'
  if (code === 'photo-invalid') return 'Usa una foto JPG, PNG o WebP de máximo 10 MB.'
  if (code === 'session-not-assigned') return 'Este paseo ya no está asignado a tu cuenta.'
  if (code === 'signed-upload-not-configured' || code === 'privileged-identity-not-configured') {
    return 'La carga de fotos no está configurada en este entorno.'
  }
  if (code.startsWith('cloudinary:') && /missing permissions/i.test(code)) {
    return 'Cloudinary rechazó la foto: la llave configurada no tiene permiso para crear archivos. Avísale a administración.'
  }
  if (code.startsWith('cloudinary:')) return `Cloudinary rechazó la foto: ${code.slice('cloudinary:'.length)}`
  return 'No pudimos subir la foto. Revisa tu conexión e inténtalo de nuevo.'
}
