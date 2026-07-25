'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useInView } from 'framer-motion'
import { FaShieldAlt, FaBolt, FaHeart, FaStar, FaDog } from 'react-icons/fa'
import { usePublicStats } from '@/lib/usePublicStats'

export default function TrustBar() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const { avgRating, happyDogs, loading } = usePublicStats()

  const trustItems = [
    { icon: FaShieldAlt, label: 'Paseadores verificados', color: '#3b82f6' },
    { icon: FaBolt, label: 'Respuesta rápida', color: '#D97706' },
    { icon: FaHeart, label: 'Seguro incluido', color: '#ec4899' },
    { icon: FaStar, label: loading ? 'Calificación' : `${avgRating}/5 calificación`, color: '#FBBF24' },
    { icon: FaDog, label: loading ? 'Perros felices' : `${happyDogs}+ perros felices`, color: '#059669' },
  ]

  return (
    <section ref={ref} className="py-12 sm:py-16 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
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
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${item.color}15`, color: item.color }}>
                  <Icon size={14} />
                </div>
                <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
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
