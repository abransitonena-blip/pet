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

const fallbackReviews = [
  {
    id: '1',
    name: 'María García',
    rating: 5,
    text: 'Excelente servicio, mi perrito Max llega feliz después de cada paseo. Muy recomendados en Zona Quebrada.',
    date: '2024-06-15',
    petName: 'Max',
  },
  {
    id: '2',
    name: 'Carlos López',
    rating: 5,
    text: 'Precios muy accesibles y el trato es increíble. Mi perra Luna ama sus paseos diarios.',
    date: '2024-06-10',
    petName: 'Luna',
  },
  {
    id: '3',
    name: 'Ana Martínez',
    rating: 5,
    text: 'El paquete semanal es perfecto para cuando trabajo. Mi perro Toby juega, corre y llega feliz.',
    date: '2024-06-05',
    petName: 'Toby',
  },
  {
    id: '4',
    name: 'Roberto Sánchez',
    rating: 4,
    text: 'Muy buen servicio de paseos. Rocky vuelve cansado y contento. Sin duda el mejor paseador de Cuautitlán.',
    date: '2024-05-28',
    petName: 'Rocky',
  },
  {
    id: '5',
    name: 'Laura Jiménez',
    rating: 5,
    text: 'Los paseos premium son una experiencia única. Mi perra Mimi explora rutas nuevas cada semana.',
    date: '2024-05-20',
    petName: 'Mimi',
  },
  {
    id: '6',
    name: 'Pedro Hernández',
    rating: 5,
    text: 'Desde que empecé con los paseos, mi perro Thor está más sano y feliz. Precio justo y calidad excelente.',
    date: '2024-05-15',
    petName: 'Thor',
  },
]

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>(fallbackReviews)
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
        // Use fallback if Firebase fails
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                <div className="h-4 bg-white/5 rounded w-3/4 mb-4" />
                <div className="h-3 bg-white/5 rounded w-full mb-2" />
                <div className="h-3 bg-white/5 rounded w-2/3" />
              </div>
            ))}
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
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <FaStar
                        key={j}
                        className={
                          j < review.rating
                            ? 'text-secondary'
                            : 'text-white/10'
                        }
                        size={14}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-white/70 mb-4 leading-relaxed line-clamp-3">
                    {review.text}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white text-xs font-bold">
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{review.name}</p>
                      {review.petName && (
                        <p className="text-xs text-white/40 flex items-center gap-1">
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
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <FaStar
                        key={j}
                        className={
                          j < review.rating
                            ? 'text-secondary'
                            : 'text-white/10'
                        }
                        size={14}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-white/70 mb-4 leading-relaxed line-clamp-3">
                    {review.text}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white text-xs font-bold">
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{review.name}</p>
                      {review.petName && (
                        <p className="text-xs text-white/40 flex items-center gap-1">
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
                      : 'bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
