'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FaStar, FaDog } from 'react-icons/fa'
import { useConfig } from '@/context/ConfigContext'
import Avatar from '@/components/ui/Avatar'

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

export default function Hero() {
  const { config } = useConfig()
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
    <section id="hero" className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
      {/* Subtle gradient bg */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-success-500/[0.03] rounded-full blur-3xl" />
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-4xl mx-auto px-4 text-center"
      >
        {/* Brand badge */}
        <motion.div variants={item} className="mb-6 flex items-center justify-center gap-2">
          <FaDog className="text-brand-500" size={12} />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-brand-500/10 border border-brand-500/15 text-brand-400 uppercase tracking-wider">
            Paseos y bienestar canino
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1 variants={item} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] tracking-tight">
          <span style={{ color: 'var(--text-primary)' }}>
            {config.heroTitle || 'Tu perro merece más que un paseo'}
          </span>
        </motion.h1>

        {/* Subhead */}
        <motion.p variants={item} className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {config.heroSubtitle || 'Paseos caninos supervisados con tecnología. Fotos, mapa y reporte en tiempo real. Porque saber que está bien, no tiene precio.'}
        </motion.p>

        {/* CTAs */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <motion.a
            href="#reservar"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn-primary"
          >
            Reserva tu paseo
          </motion.a>
          <motion.a
            href="#servicios"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn-secondary"
          >
            Ver planes
          </motion.a>
        </motion.div>

        {/* Stats inline */}
        <motion.div variants={item} className="flex items-center justify-center gap-8 sm:gap-12 mb-10">
          {[
            { value: '50+', label: 'Perros felices' },
            { value: '4.9★', label: 'Calificación' },
            { value: '$30', label: 'Desde' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-xl sm:text-2xl font-bold gradient-text">{stat.value}</div>
              <div className="text-[11px] sm:text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Best review card */}
        {topReview && (
          <motion.div variants={item} className="max-w-md mx-auto">
            <div className="rounded-2xl p-4 sm:p-5 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-center gap-0.5 mb-2">
                {Array.from({ length: topReview.rating }).map((_, j) => (
                  <FaStar key={j} className="text-brand-400" size={12} />
                ))}
              </div>
              <p className="text-sm mb-3 leading-relaxed italic" style={{ color: 'var(--text-secondary)' }}>
                &ldquo;{topReview.text}&rdquo;
              </p>
              <div className="flex items-center justify-center gap-2">
                <Avatar name={topReview.name} size="sm" />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{topReview.name}</span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-8 border-2 rounded-full flex justify-center"
          style={{ borderColor: 'var(--text-muted)' }}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 h-2.5 bg-brand-500 rounded-full mt-1.5"
          />
        </motion.div>
      </motion.div>
    </section>
  )
}
