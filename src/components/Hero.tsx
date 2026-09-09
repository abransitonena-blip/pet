'use client'

import { motion } from 'framer-motion'
import { PawPrint } from 'lucide-react'
import { usePublicStats } from '@/lib/usePublicStats'
import { useConfig } from '@/context/ConfigContext'
import Link from 'next/link'

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

  return (
    <section aria-label="Hero" id="hero" className="relative flex min-h-[34rem] scroll-mt-20 items-center justify-center overflow-hidden pb-12 pt-20 sm:min-h-[38rem]">
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
            className="btn btn-primary"
          >
            Entrar a Familia PET
          </Link>
          <motion.a
            href="/#como-funciona"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-secondary"
          >
            Cómo funciona
          </motion.a>
        </motion.div>

        {!statsLoading && (happyDogs > 0 || avgRating > 0) && (
          <motion.div variants={item} className="flex items-center justify-center gap-6 sm:gap-10 mt-10">
          {[
            { value: statsLoading ? undefined : happyDogs > 0 ? `${happyDogs}+` : undefined, label: 'Perros felices' },
            { value: statsLoading ? undefined : avgRating > 0 ? `${avgRating}` : undefined, label: 'Calificación' },
          ].filter((stat) => stat.value).map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-lg sm:text-xl font-bold text-primary">{stat.value}</div>
              <div className="text-xs mt-0.5 text-muted">{stat.label}</div>
            </div>
          ))}
          </motion.div>
        )}

      </motion.div>
    </section>
  )
}
