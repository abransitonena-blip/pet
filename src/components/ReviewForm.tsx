'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { FaStar, FaPaw, FaSpinner, FaCheckCircle } from 'react-icons/fa'

export default function ReviewForm() {
  const [name, setName] = useState('')
  const [petName, setPetName] = useState('')
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [hover, setHover] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) return
    setSending(true)

    try {
      await addDoc(collection(db, 'reviews'), {
        name,
        petName: petName || '',
        rating,
        text,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
      })
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
      <div className="flex items-center gap-3 mb-6">
        <FaPaw className="text-primary text-xl" />
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
                <FaStar
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
          <p className="text-xs text-center" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}
        <motion.button
          type="submit"
          disabled={sending || sent || rating === 0}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          {sending ? (
            <FaSpinner className="animate-spin" />
          ) : sent ? (
            <FaCheckCircle />
          ) : (
            <FaPaw />
          )}
          {sending ? 'Enviando...' : sent ? '¡Gracias!' : 'Publicar reseña'}
        </motion.button>
      </form>
    </motion.div>
  )
}
