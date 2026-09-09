'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { Star, PawPrint, Loader2, CheckCircle2, User } from 'lucide-react'
import Link from 'next/link'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

export default function ReviewForm() {
  const [user, setUser] = useState<{ uid: string; displayName: string | null } | null>(null)
  const [name, setName] = useState('')
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [hover, setHover] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED) return
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ? { uid: u.uid, displayName: u.displayName } : null)
    })
    return unsub
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED) {
      setError('Las reseñas están temporalmente desactivadas.')
      return
    }
    if (rating === 0 || !user) return
    setSending(true)

    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('auth-required')
      const response = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, rating, text }),
      })
      if (!response.ok) {
        setError('Error al enviar. Intenta de nuevo.')
        setSending(false)
        return
      }
    } catch {
      setError("Error al enviar. Intenta de nuevo.")
      setSending(false)
      return
    }

    setSending(false)
    setSent(true)
    setError("")
    setName('')
    setRating(0)
    setText('')
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass-card p-5 sm:p-6 max-w-md mx-auto"
    >
      {!FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED ? (
        <div className="text-center py-6" data-testid="public-reviews-unavailable">
          <PawPrint className="mx-auto mb-3 text-muted" size={22} />
          <p className="text-sm font-semibold text-ink">Las reseñas están temporalmente desactivadas</p>
        </div>
      ) : !user ? (
        <div className="text-center py-6">
          <User className="text-3xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Inicia sesión para dejar tu reseña</p>
          <Link href="/login" className="btn-primary inline-flex items-center gap-2 text-sm">
            Iniciar sesión
          </Link>
        </div>
      ) : (
      <>
      <div className="flex items-center gap-2 mb-4">
        <PawPrint className="text-primary" size={18} />
        <h3 className="text-base font-bold">Deja tu reseña</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="review-name" className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Tu nombre *
          </label>
          <input
            id="review-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ej: María"
            className="input-field"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Calificación *
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  size={24}
                  className={
                    star <= (hover || rating)
                      ? 'text-secondary drop-shadow-lg'
                      : ''
                  }
                  style={{
                    color:
                      star <= (hover || rating)
                        ? undefined
                        : 'var(--text-muted)',
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="review-text" className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Tu reseña *
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={3}
            placeholder="Cuéntanos cómo fue tu experiencia..."
            className="input-field resize-none"
          />
        </div>

        {error && (
          <p className="text-xs text-center" role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}
        <motion.button
          type="submit"
          disabled={sending || sent || rating === 0}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          {sending ? (
            <Loader2 className="animate-spin" />
          ) : sent ? (
            <CheckCircle2 />
          ) : (
            <PawPrint />
          )}
          {sending ? 'Enviando...' : sent ? '¡Gracias!' : 'Publicar reseña'}
        </motion.button>
      </form>
      </>
      )}
    </motion.div>
  )
}
