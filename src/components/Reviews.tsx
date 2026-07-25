'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { db } from '@/firebase/config'
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore'
import { FaStar, FaQuoteLeft, FaPaw } from 'react-icons/fa'

interface Review {
  id: string
  name: string
  rating: number
  text: string
  date: string
  petName?: string
}

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    async function fetchReviews() {
      try {
        const q = query(
          collection(db, 'reviews'),
          orderBy('date', 'desc'),
          limit(20)
        )
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Review[]
          setReviews(data)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchReviews()
  }, [])

  useEffect(() => {
    if (reviews.length === 0) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [reviews.length])

  const visibleReviews = []
  for (let i = 0; i < 3; i++) {
    const idx = (currentIndex + i) % reviews.length
    if (reviews[idx]) visibleReviews.push(reviews[idx])
  }

  return (
    <section id="resenas" className="relative py-24 sm:py-32" ref={ref}>
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">
            Testimonios
          </span>
          <h2 className="section-title mt-3">
            Lo que dicen los{' '}
            <span className="gradient-text">dueños</span>
          </h2>
          <p className="section-subtitle">
            La felicidad de los perros y la tranquilidad de sus dueños es nuestra
            mejor carta de presentación.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass-card p-6 w-80 h-48 animate-pulse"
              >
                <div className="skeleton h-4 rounded w-3/4 mb-4" />
                <div className="skeleton h-3 rounded w-full mb-2" />
                <div className="skeleton h-3 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12">
            <FaPaw className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sé el primero en dejarnos una reseña</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:flex justify-center gap-6 overflow-hidden py-4">
              {visibleReviews.map((review, i) => (
                <motion.div
                  key={review.id + i}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.5 }}
                  className="glass-card p-6 w-80 flex-shrink-0"
                >
                  <FaQuoteLeft className="text-primary/20 text-xl mb-3" />
                  <div className="flex items-center gap-1 mb-3" aria-label={`${review.rating} de 5 estrellas`}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <FaStar
                        key={j}
                        className={j < review.rating ? 'text-secondary' : 'opacity-20'}
                        style={j >= review.rating ? { color: 'var(--text-muted)' } : undefined}
                        size={14}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="text-sm mb-4 leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                    {review.text}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white text-xs font-bold">
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{review.name}</p>
                      {review.petName && (
                        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <FaPaw className="text-primary" size={10} />
                          {review.petName}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex lg:hidden review-scroll overflow-x-auto gap-4 pb-4 snap-x snap-mandatory">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="glass-card p-6 min-w-[280px] snap-center flex-shrink-0"
                >
                  <FaQuoteLeft className="text-primary/20 text-xl mb-3" />
                  <div className="flex items-center gap-1 mb-3" aria-label={`${review.rating} de 5 estrellas`}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <FaStar
                        key={j}
                        className={j < review.rating ? 'text-secondary' : 'opacity-20'}
                        style={j >= review.rating ? { color: 'var(--text-muted)' } : undefined}
                        size={14}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="text-sm mb-4 leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                    {review.text}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white text-xs font-bold">
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{review.name}</p>
                      {review.petName && (
                        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <FaPaw className="text-primary" size={10} />
                          {review.petName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-2 mt-8">
              {reviews.slice(0, Math.min(reviews.length, 7)).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === currentIndex
                      ? 'bg-primary w-6'
                      : 'hover:opacity-60'
                  }`}
                  style={i !== currentIndex ? { background: 'var(--text-muted)' } : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
