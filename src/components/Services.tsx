'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Clock, Dog, Zap, Camera, Calendar } from 'lucide-react'
import { OFFERED_CATEGORIES } from '@/lib/walkServices'
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
    <section aria-label="Servicios" id="servicios" className="relative scroll-mt-20 py-24 sm:py-32" ref={ref}>
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

        {/* Two plans on offer: a centred pair rather than half of an empty four-column row. */}
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 sm:gap-6">
          {OFFERED_CATEGORIES.map((cat, i) => {
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

                <Link href="/login?redirect=/familia/nueva-reserva" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
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
