'use client'

import { useEffect, useState } from 'react'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

/**
 * Los enlaces a las fotos de unos perros, pedidos de un jalón.
 *
 * La foto de un perro es un asset privado: su referencia no es un URL y hay que
 * cambiarla por un enlace que caduca. Se piden todos juntos para que una lista
 * de perros no haga una petición por tarjeta, y se vuelven a pedir cuando alguna
 * referencia cambia -- que es justo cuando la familia acaba de subir una foto.
 */

export interface DogPhotoRequest {
  id: string
  reference?: string
}

export function useDogPhotos(dogs: readonly DogPhotoRequest[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = dogs.filter((dog) => Boolean(dog.reference)).map((dog) => `${dog.id}:${dog.reference}`).sort().join('|')

  useEffect(() => {
    if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED || key === '') {
      setUrls({})
      return
    }
    const dogIds = key.split('|').map((entry) => entry.slice(0, entry.indexOf(':')))
    let cancelled = false
    ;(async () => {
      try {
        const { auth } = await import('@/firebase/config')
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) return
        const response = await fetch('/api/media/private/dog-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ dogIds }),
        })
        const data = await response.json().catch(() => ({})) as { photos?: Array<{ dogId?: unknown; url?: unknown }> }
        if (!response.ok || cancelled) return
        setUrls(Object.fromEntries((data.photos ?? [])
          .filter((photo): photo is { dogId: string; url: string } => typeof photo.dogId === 'string' && typeof photo.url === 'string')
          .map((photo) => [photo.dogId, photo.url])))
      } catch {
        // Sin foto se ve la marca teñida del perro: no hay nada que avisar.
      }
    })()
    return () => { cancelled = true }
  }, [key])

  return urls
}
