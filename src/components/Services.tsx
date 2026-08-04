'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Clock, Dog, Zap, Camera, Calendar } from 'lucide-react'
import { SERVICE_CATEGORIES } from '@/lib/services'
import Link from 'next/link'

const ICON_MAP: Record<string, React.ElementType> = {
  cotidiano: Dog,
  energia: Zap,
  acompanamiento: Camera,
  rutina: Calendar,
}

export default function Services() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section aria-label="Servicios" id="servicios" className="relative py-24 sm:py-32" ref={ref}>
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.32 }}
          className="text-center mb-12"
        >
          <span className="text-primary-hover text-sm uppercase tracking-widest font-medium">
            Servicios
          </span>
          <h2 className="section-title mt-3">
            Lo que ofrecemos
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {SERVICE_CATEGORIES.map((cat, i) => {
            const Icon = ICON_MAP[cat.id] || Dog
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4, transition: { duration: 0.3 } }}
                className="card p-5"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="text-primary" size={18} />
                </div>

                <h3 className="text-sm font-semibold mb-1 text-ink">{cat.name}</h3>

                <div className="flex items-center gap-2 mb-2 text-sm text-muted">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {cat.duration}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-muted mb-3 line-clamp-2">{cat.description}</p>

                <Link href="/login?redirect=/familia/nueva-reserva" className="text-sm font-medium text-primary hover:text-primary-hover transition-colors inline-flex items-center gap-1">
                  Ver detalles
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
