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
  const [petName, setPetName] = useState('')
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
      setError('Las reseñas se habilitarán en Familia PET cuando podamos verificar el paseo.')
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
        body: JSON.stringify({ name, petName, rating, text }),
      })
      const result = await response.json() as { code?: string }
      if (!response.ok) {
        setError(result.code === 'not-eligible'
          ? 'Solo puedes reseñar después de completar un paseo pagado. Si ya completaste uno, escríbenos.'
          : 'Error al enviar. Intenta de nuevo.')
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
    setPetName('')
    setRating(0)
    setText('')
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass-card p-6 sm:p-8"
    >
      {!FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED ? (
        <div className="text-center py-8" data-testid="public-reviews-unavailable">
          <PawPrint className="mx-auto mb-3 text-muted" size={24} />
          <p className="text-sm font-semibold text-ink">Las reseñas públicas están temporalmente desactivadas</p>
          <p className="text-xs text-muted mt-2 mb-4">La futura reseña se solicitará desde Familia PET después de verificar un paseo pagado y completado.</p>
          <Link href="/familia" className="btn-primary inline-flex min-h-11 items-center">Ir a Familia PET</Link>
        </div>
      ) : !user ? (
        <div className="text-center py-8">
          <User className="text-3xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Inicia sesión para dejar tu reseña</p>
          <Link href="/login" className="btn-primary inline-flex items-center gap-2 text-sm">
            Iniciar sesión
          </Link>
        </div>
      ) : (
      <>
      <div className="flex items-center gap-3 mb-6">
        <PawPrint className="text-primary text-xl" />
        <h3 className="text-xl font-bold">Deja tu reseña</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Tu nombre *
            </label>
            <input
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
              Nombre de tu perro
            </label>
            <input
              type="text"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="Ej: Max"
              className="input-field"
            />
          </div>
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
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Tu reseña *
          </label>
          <textarea
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
