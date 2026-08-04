'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Star, PawPrint } from 'lucide-react'
import { usePublicStats } from '@/lib/usePublicStats'
import { useConfig } from '@/context/ConfigContext'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

export default function Hero() {
  const { config } = useConfig()
  const { avgRating, happyDogs, loading: statsLoading } = usePublicStats()
  const [topReview, setTopReview] = useState<{ name: string; text: string; rating: number } | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('rating', 'desc'), limit(5))
    getDocs(q)
      .then((snap) => {
        const data = snap.docs.map((d) => d.data() as { name: string; text: string; rating: number })
        const best = data.find((r) => r.text?.length > 15)
        if (best) setTopReview(best)
      })
      .catch(() => {})
  }, [])

  return (
    <section aria-label="Hero" id="hero" className="relative min-h-[60vh] flex items-center justify-center overflow-hidden pt-16 pb-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[400px] h-[400px] bg-trust/10 rounded-full blur-[80px]" />
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-3xl mx-auto px-4 text-center"
      >
        <motion.div variants={item} className="mb-4 flex items-center justify-center gap-2">
          <PawPrint className="text-primary" size={14} />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary-hover uppercase tracking-wider">
            Paseos y bienestar canino
          </span>
        </motion.div>

        <motion.h1 variants={item} className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-[1.1] tracking-tight text-ink">
          {config.heroTitle}
        </motion.h1>

        <motion.p variants={item} className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed text-muted">
          {config.heroSubtitle}
        </motion.p>

        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login?redirect=/familia/nueva-reserva"
            className="btn-primary inline-flex items-center gap-2"
          >
            Entrar a Familia PET
          </Link>
          <motion.a
            href="#como-funciona"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn-secondary"
          >
            Cómo funciona
          </motion.a>
        </motion.div>

        <motion.div variants={item} className="flex items-center justify-center gap-6 sm:gap-10 mt-10">
          {[
            { value: statsLoading ? undefined : happyDogs > 0 ? `${happyDogs}+` : undefined, label: 'Perros felices' },
            { value: statsLoading ? undefined : avgRating > 0 ? `${avgRating}` : undefined, label: 'Calificación' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-lg sm:text-xl font-bold text-primary">{stat.value ?? '—'}</div>
              <div className="text-xs mt-0.5 text-muted">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {topReview && (
          <motion.div variants={item} className="max-w-sm mx-auto mt-8">
            <div className="card p-4 sm:p-5 text-center">
              <div className="flex items-center justify-center gap-0.5 mb-2">
                {Array.from({ length: topReview.rating }).map((_, j) => (
                  <Star key={j} className="text-primary" size={12} fill="currentColor" />
                ))}
              </div>
              <p className="text-sm mb-3 leading-relaxed italic text-muted">
                &ldquo;{topReview.text}&rdquo;
              </p>
              <div className="flex items-center justify-center gap-2">
                <Avatar name={topReview.name} size="sm" />
                <span className="text-xs font-medium text-muted">{topReview.name}</span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  )
}
