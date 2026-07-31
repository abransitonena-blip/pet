'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Clock, ArrowRight, Dog, Zap, Camera, Calendar } from 'lucide-react'
import { SERVICE_CATEGORIES } from '@/lib/services'

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
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary text-sm uppercase tracking-widest font-medium">
            Categorías
          </span>
          <h2 className="section-title mt-3">
            Elige lo que tu perro <span className="text-primary">necesita</span>
          </h2>
          <p className="section-subtitle">
            Cada perro es único. Encuentra el paseo ideal para su energía, personalidad y rutina.
          </p>
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
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
                className="card card-interactive p-6 group relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-all duration-300">
                  <Icon className="text-primary" size={22} />
                </div>

                <h3 className="text-lg font-semibold mb-1 text-ink">{cat.name}</h3>

                <div className="flex items-center gap-3 mb-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {cat.duration}
                  </span>
                  <span>{cat.modality}</span>
                </div>

                <p className="text-sm mb-4 leading-relaxed text-muted">{cat.description}</p>

                {cat.benefits.length > 0 && (
                  <ul className="space-y-1.5 mb-4">
                    {cat.benefits.map((b, j) => (
                      <li key={j} className="text-xs flex items-start gap-2 text-muted">
                        <span className="text-primary mt-0.5 shrink-0">✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}

                {cat.restrictions.length > 0 && (
                  <div className="mb-4 pt-3 border-t border-border">
                    {cat.restrictions.map((r, j) => (
                      <p key={j} className="text-2xs text-muted italic flex items-start gap-1.5">
                        <span>ℹ</span>
                        {r}
                      </p>
                    ))}
                  </div>
                )}

                <motion.a
                  href="#cotizar"
                  whileHover={{ x: 4 }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary mt-2"
                >
                  Obtén una cotización <ArrowRight size={14} />
                </motion.a>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-12"
        >
          <p className="text-sm text-muted">
            Los precios varían según tu zona, horario y número de perros. Sin contratos, sin mensualidades.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
