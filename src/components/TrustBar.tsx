'use client'

import { motion } from 'framer-motion'
import { useRef } from 'react'
import { useInView } from 'framer-motion'
import { Shield, Zap, Heart, Star, Dog } from 'lucide-react'
import { usePublicStats } from '@/lib/usePublicStats'

export default function TrustBar() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const { avgRating, totalReviews, happyDogs, totalWalks } = usePublicStats()

  const trustItems = [
    { icon: Shield, label: 'Equipo propio' },
    { icon: Zap, label: 'Reserva en minutos' },
    { icon: Heart, label: 'Atención personalizada' },
    ...(avgRating > 0 ? [{ icon: Star, label: `${avgRating}/5 (${totalReviews} reseñas)` }] : []),
    ...(totalWalks > 0 ? [{ icon: Dog, label: `${happyDogs}+ perros felices` }] : []),
  ]

  return (
    <section aria-label="Barra de confianza" ref={ref} className="py-12 sm:py-16 border-b border-border">
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.32 }}
          className="flex flex-wrap items-center justify-center gap-6 sm:gap-10"
        >
          {trustItems.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                  <Icon size={14} />
                </div>
                <span className="text-xs sm:text-sm font-medium text-muted">
                  {item.label}
                </span>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
