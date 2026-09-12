'use client'

import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { DOG_PHOTO_FOLDER, DOG_PHOTO_MAX_BYTES, DOG_PHOTO_TYPES, isDogPhotoReference } from '@/lib/dogPhotos'

/**
 * Sube la foto de un perro como asset privado.
 *
 * El servidor firma la subida después de comprobar que ese perro es de quien
 * pregunta (/api/media/private/signature); el archivo va directo a Cloudinary,
 * así que el límite de tamaño de Vercel nunca aplica. El asset queda
 * `authenticated`: su URL a secas no muestra nada, y cada vista pasa por
 * /api/media/private/dog-photos, que entrega enlaces que caducan.
 */
export async function uploadDogPhoto(dogId: string, file: File): Promise<string> {
  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) throw new Error('photos-disabled')
  if (!DOG_PHOTO_TYPES.includes(file.type) || file.size > DOG_PHOTO_MAX_BYTES) throw new Error('photo-invalid')

  const { auth } = await import('@/firebase/config')
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('auth-required')

  const signedResponse = await fetch('/api/media/private/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ folder: DOG_PHOTO_FOLDER, dogId }),
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
  if (!isDogPhotoReference(result.public_id)) throw new Error('upload-rejected-shape')
  return result.public_id
}
