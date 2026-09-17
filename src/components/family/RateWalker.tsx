'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import Card from '@/components/ui/Card'
import { WALKER_REVIEW_TEXT_LIMIT, validateWalkerReview, walkerReviewErrorMessage } from '@/lib/walkerReviews'

/**
 * Califica a tu paseador, una vez por paseo.
 *
 * Sólo aparece en un paseo terminado y de quien pregunta -- las reglas lo
 * comprueban contra la sesión guardada, así que no hay forma de calificar un
 * paseo ajeno ni uno que no ocurrió. Una vez enviada no se puede cambiar: una
 * reseña que se reescribe deja de ser un registro de lo que pasó, y eso se dice
 * antes de enviarla, no después.
 */

interface RateWalkerProps {
  sessionId: string
  walkerId: string
  walkerName: string
}

export default function RateWalker({ sessionId, walkerId, walkerName }: RateWalkerProps) {
  const [existing, setExisting] = useState<{ rating: number; text: string } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, 'walkerReviews', sessionId))
      .then((snapshot) => {
        if (cancelled) return
        const data = snapshot.exists() ? snapshot.data() : null
        setExisting(data ? { rating: Number(data.rating) || 0, text: String(data.text ?? '') } : null)
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [sessionId])

  if (!loaded || !walkerId) return null

  if (existing) {
    return (
      <Card className="p-4 shadow-none">
        <h2 className="text-sm font-semibold text-ink">Ya calificaste este paseo</h2>
        <Stars value={existing.rating} />
        {existing.text && <p className="mt-2 text-sm text-muted">{existing.text}</p>}
      </Card>
    )
  }

  const submit = async () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const errors = validateWalkerReview({ rating, text: text.trim() })
    if (errors.length > 0) {
      setError(walkerReviewErrorMessage(errors[0]))
      return
    }
    setSaving(true)
    setError('')
    try {
      await setDoc(doc(db, 'walkerReviews', sessionId), {
        sessionId,
        walkerId,
        customerId: uid,
        rating,
        text: text.trim(),
        createdAt: serverTimestamp(),
      })
      setExisting({ rating, text: text.trim() })
    } catch {
      setError('No pudimos guardar tu calificación. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4 shadow-none">
      <h2 className="text-sm font-semibold text-ink">¿Cómo estuvo {walkerName}?</h2>
      <p className="mt-0.5 text-xs text-muted">Tu calificación no se puede cambiar después de enviarla.</p>

      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} estrella${value === 1 ? '' : 's'}`}
            onClick={() => { setRating(value); setError('') }}
            className="grid h-11 w-11 place-items-center rounded-xl transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Star size={22} className={value <= rating ? 'fill-primary text-primary' : 'text-muted'} aria-hidden="true" />
          </button>
        ))}
      </div>

      <label htmlFor="walker-review-text" className="mt-3 block text-xs text-muted">
        Un comentario, si quieres (opcional)
      </label>
      <textarea
        id="walker-review-text"
        value={text}
        maxLength={WALKER_REVIEW_TEXT_LIMIT}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        className="input-field mt-1 w-full resize-none"
        placeholder="Qué salió bien, o qué le dirías para la próxima."
      />

      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={saving || rating === 0}
        className="btn-primary mt-3 min-h-11 w-full disabled:opacity-40"
      >
        {saving ? 'Enviando…' : 'Enviar calificación'}
      </button>
    </Card>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <p className="mt-1 flex gap-0.5" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={16} className={star <= value ? 'fill-primary text-primary' : 'text-muted'} aria-hidden="true" />
      ))}
    </p>
  )
}
