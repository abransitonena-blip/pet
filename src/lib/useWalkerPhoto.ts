'use client'

import { useEffect, useState } from 'react'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

/**
 * El paseador de un paseo: su nombre y su foto, con un enlace que caduca.
 *
 * No se pregunta por un paseador, se pregunta por un paseo -- o por uno mismo,
 * con `self`. El servidor decide quién puede verlo, así que una familia nunca
 * puede pedir la foto de alguien que no va a su casa.
 */

export interface WalkerCard {
  name: string
  photoUrl: string
}

export function useWalkerPhoto(query: { sessionId?: string; self?: boolean; refresh?: string }): WalkerCard | null {
  const [walker, setWalker] = useState<WalkerCard | null>(null)
  const key = query.self ? 'self' : query.sessionId ?? ''
  const refresh = query.refresh ?? ''

  useEffect(() => {
    if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED || !key) {
      setWalker(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { auth } = await import('@/firebase/config')
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) return
        const response = await fetch('/api/media/private/walker-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify(key === 'self' ? { self: true } : { sessionId: key }),
        })
        const data = await response.json().catch(() => ({})) as { walker?: { name?: unknown; photoUrl?: unknown } | null }
        if (!response.ok || cancelled) return
        const found = data.walker
        setWalker(found && typeof found.name === 'string'
          ? { name: found.name, photoUrl: typeof found.photoUrl === 'string' ? found.photoUrl : '' }
          : null)
      } catch {
        // Sin foto se ve el nombre, y sin nombre no se muestra la tarjeta.
      }
    })()
    return () => { cancelled = true }
  }, [key, refresh])

  return walker
}
