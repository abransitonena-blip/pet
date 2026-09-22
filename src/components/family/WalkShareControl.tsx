'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { SHARE_LINK_MAX_MINUTES } from '@/lib/locationShare'

/**
 * Compartir por un tiempo, sin cuenta, dónde va este paseo (fase 36).
 *
 * Apagado por FEATURE_FLAGS.LOCATION_SHARE_LINKS_ENABLED hasta que exista el
 * aviso de privacidad revisado por abogado -- ver ese flag. El botón de aquí
 * no aparece mientras tanto: no hay control a medio construir en pantalla.
 *
 * Un enlace nuevo no recuerda al anterior: si la familia recarga la página
 * después de crear uno, esta tarjeta vuelve a "Compartir" aunque el enlace
 * viejo siga funcionando hasta que caduque o lo revoquen desde aquí mismo,
 * en la misma visita.
 */

const DURATIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hora' },
  { minutes: SHARE_LINK_MAX_MINUTES, label: '3 horas' },
] as const

interface ShareState {
  token: string
  url: string
  expiresAt: number
}

export default function WalkShareControl({ sessionId }: { sessionId: string }) {
  const [minutes, setMinutes] = useState<number>(60)
  const [share, setShare] = useState<ShareState | null>(null)
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')
  const [copied, setCopied] = useState(false)

  const create = async () => {
    setState('working')
    try {
      const { auth } = await import('@/firebase/config')
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('auth-required')
      const response = await fetch('/api/tracking/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId, minutes }),
      })
      const result = await response.json().catch(() => ({})) as { token?: string; url?: string; expiresAt?: number }
      if (!response.ok || !result.token || !result.url || !result.expiresAt) throw new Error('share-create-failed')
      setShare({ token: result.token, url: result.url, expiresAt: result.expiresAt })
      setState('idle')
    } catch {
      setState('error')
    }
  }

  const revoke = async () => {
    if (!share) return
    setState('working')
    try {
      const { auth } = await import('@/firebase/config')
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('auth-required')
      const response = await fetch('/api/tracking/share/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ token: share.token }),
      })
      if (!response.ok) throw new Error('share-revoke-failed')
      setShare(null)
      setState('idle')
    } catch {
      setState('error')
    }
  }

  const copyLink = async () => {
    if (!share) return
    try {
      await navigator.clipboard.writeText(share.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (!FEATURE_FLAGS.LOCATION_SHARE_LINKS_ENABLED) return null

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Share2 size={14} aria-hidden="true" /> Compartir este paseo
      </p>

      {state === 'error' && (
        <p role="alert" className="text-xs text-red-700">No pudimos completar la acción. Intenta de nuevo.</p>
      )}

      {!share ? (
        <>
          <p className="text-xs text-muted">
            Crea un enlace para que alguien sin cuenta vea por dónde va el paseo, por el tiempo que elijas. Puedes
            apagarlo cuando quieras.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {DURATIONS.map((option) => (
              <button
                key={option.minutes}
                type="button"
                onClick={() => setMinutes(option.minutes)}
                aria-pressed={minutes === option.minutes}
                className={`min-h-9 rounded-full px-3 text-xs font-medium ${minutes === option.minutes ? 'bg-primary/15 text-primary' : 'bg-ink/5 text-muted'}`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void create()}
              disabled={state === 'working'}
              className="min-h-9 rounded-full bg-primary px-4 text-xs font-semibold text-white disabled:opacity-60"
            >
              {state === 'working' ? 'Creando…' : 'Compartir ubicación'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted">
            Deja de funcionar solo a las {new Date(share.expiresAt).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })}.
          </p>
          <p className="break-all rounded-lg bg-ink/[0.03] px-2 py-1.5 text-2xs text-ink">{share.url}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/10 px-3 text-xs font-medium text-ink"
            >
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {copied ? 'Enlace copiado' : 'Copiar enlace'}
            </button>
            <button
              type="button"
              onClick={() => void revoke()}
              disabled={state === 'working'}
              className="min-h-9 rounded-full px-3 text-xs font-semibold text-red-700 disabled:opacity-60"
            >
              Dejar de compartir
            </button>
          </div>
        </>
      )}
    </div>
  )
}
