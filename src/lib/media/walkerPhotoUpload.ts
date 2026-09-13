'use client'

import { FEATURE_FLAGS } from '@/lib/featureFlags'
import {
  WALKER_PHOTO_FOLDER,
  WALKER_PHOTO_MAX_BYTES,
  WALKER_PHOTO_TYPES,
  isWalkerPhotoReference,
} from '@/lib/walkerPhotos'

/**
 * Sube la foto de un paseador como asset privado.
 *
 * El servidor firma la subida después de comprobar que quien pide es un paseador
 * activo; el archivo va directo a Cloudinary. El asset queda `authenticated`: su
 * URL a secas no muestra nada, y cada vista pasa por una ruta que decide quién
 * puede verla.
 */
export async function uploadWalkerPhoto(file: File): Promise<string> {
  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) throw new Error('photos-disabled')
  if (!WALKER_PHOTO_TYPES.includes(file.type) || file.size > WALKER_PHOTO_MAX_BYTES) throw new Error('photo-invalid')

  const { auth } = await import('@/firebase/config')
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('auth-required')

  const signedResponse = await fetch('/api/media/private/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ folder: WALKER_PHOTO_FOLDER }),
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
  if (!isWalkerPhotoReference(result.public_id)) throw new Error('upload-rejected-shape')
  return result.public_id
}
