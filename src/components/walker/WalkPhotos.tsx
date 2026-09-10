'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ImageOff, X } from 'lucide-react'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

/**
 * Fotos privadas de un paseo.
 *
 * The references stored on the report are opaque ids, not links: the assets
 * are `type=authenticated` and cannot be fetched by URL. The server checks who
 * is asking (the family of that walk, its walker, or staff) and returns links
 * that expire after a few minutes, which is all this component ever renders.
 */

interface WalkPhotosProps {
  sessionId: string
  references: readonly string[]
  /** Only the walker editing a draft can take a photo off the report. */
  onRemove?: (reference: string) => void
}

export default function WalkPhotos({ sessionId, references, onRemove }: WalkPhotosProps) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const key = references.join('|')

  useEffect(() => {
    if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED || !key) {
      setUrls({})
      setState('idle')
      return
    }
    let cancelled = false
    setState('loading')
    ;(async () => {
      try {
        const { auth } = await import('@/firebase/config')
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('auth-required')
        const response = await fetch('/api/media/private/walk-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ sessionId }),
        })
        const data = await response.json().catch(() => ({})) as { photos?: Array<{ reference?: unknown; url?: unknown }> }
        if (!response.ok) throw new Error('walk-photos-failed')
        if (cancelled) return
        setUrls(Object.fromEntries((data.photos ?? [])
          .filter((photo): photo is { reference: string; url: string } => typeof photo.reference === 'string' && typeof photo.url === 'string')
          .map((photo) => [photo.reference, photo.url])))
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [sessionId, key])

  if (references.length === 0) return null

  return (
    <div className="space-y-2">
      {state === 'error' && (
        <p role="status" className="text-xs text-red-700">No pudimos mostrar las fotos en este momento. Recarga la página para intentarlo de nuevo.</p>
      )}
      <ul className="grid grid-cols-3 gap-2">
        {references.map((reference, index) => (
          <li key={reference} className="relative aspect-square overflow-hidden rounded-2xl bg-ink/[0.04]">
            {urls[reference] ? (
              <Image
                src={urls[reference]}
                alt={`Foto ${index + 1} del paseo`}
                fill
                sizes="(min-width: 640px) 200px, 33vw"
                unoptimized
                className="object-cover"
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-muted">
                {state === 'loading' ? <span className="h-4 w-4 animate-pulse rounded-full bg-ink/10" /> : <ImageOff size={16} aria-hidden="true" />}
              </span>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(reference)}
                aria-label={`Quitar la foto ${index + 1} del reporte`}
                className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-ink/60 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
