import 'client-only'

import { FEATURE_FLAGS } from '@/lib/featureFlags'

export async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  void file
  void folder
  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) {
    throw new Error('PRIVATE_MEDIA_UPLOADS_UNAVAILABLE')
  }
  throw new Error('SIGNED_MEDIA_BACKEND_REQUIRED')
}

export async function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Geolocalización no disponible'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('No se pudo obtener ubicación')),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}
