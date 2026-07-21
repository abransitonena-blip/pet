'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  FaDog,
  FaPaw,
  FaWalking,
  FaTree,
  FaSun,
  FaClock,
  FaStar,
  FaUsers,
} from 'react-icons/fa'

import { usePrices } from '@/context/PricesContext'
import { SERVICES, calculateSavings } from '@/lib/services'

const ICON_MAP: Record<string, typeof FaDog> = {
  'Paseo Individual': FaWalking,
  'Paseo Extendido': FaClock,
  'Paseo Grupal': FaUsers,
  'Paseo + Adiestramiento': FaStar,
  'Paseo Express': FaPaw,
  'Paseo + Reporte': FaDog,
  'Paquete Semanal': FaSun,
}

export default function Services() {
  const { prices } = usePrices()
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="servicios" className="relative py-24 sm:py-32" ref={ref}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-primary/5 text-8xl rotate-12">🐾</div>
        <div className="absolute bottom-20 right-10 text-primary/5 text-8xl -rotate-12">🐾</div>
        <div className="absolute top-1/2 left-1/4 text-primary/[0.03] text-9xl">🐕</div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">
            Paquetes de paseos
          </span>
          <h2 className="section-title mt-3">
            Precios <span className="gradient-text">accesibles</span>
          </h2>
          <p className="section-subtitle">
            Todos nuestros paseos son supervisados, seguros y pensados para la
            felicidad de tu perro. ¡Elige el que más te guste!
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {SERVICES.map((svc, i) => {
            const Icon = ICON_MAP[svc.name] || FaPaw
            const price = prices[svc.name] ?? svc.price
            const { savings } = calculateSavings(svc.name, prices['Paseo Individual'] ?? 30)
            return (
              <motion.div
                key={svc.name}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{
                  y: -8,
                  transition: { duration: 0.3 },
                }}
                className="glass-card p-6 group cursor-default relative overflow-hidden"
              >
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-all duration-500" />

                <div className="relative z-10">
                  {svc.quantity && savings > 0 && (
                    <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary to-amber-600 text-white text-[9px] font-semibold uppercase tracking-wider">
                      Más popular
                    </div>
                  )}

                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-amber-600/20 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-amber-600/30 transition-all duration-300"
                  >
                    <Icon className="text-xl text-primary" />
                  </motion.div>

                  <h3 className="text-lg font-semibold text-white mb-1">
                    {svc.name}
                  </h3>
                  <p className="text-sm text-white/50 mb-3 leading-relaxed">
                    {svc.mainBenefit} · {svc.modality}
                  </p>

                  {svc.highlights && svc.highlights.length > 0 && (
                    <ul className="space-y-1 mb-4">
                      {svc.highlights.map((h: string, j: number) => (
                        <li key={j} className="text-xs text-white/40 flex items-center gap-1.5">
                          <FaPaw className="text-primary shrink-0" size={8} />
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-2xl font-bold gradient-text">
                      ${price.toLocaleString()}
                    </span>
                    <span className="text-xs text-white/40 flex items-center gap-1">
                      <FaClock size={10} />
                      {svc.duration}
                    </span>
                  </div>
                </div>
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
          <p className="text-white/40 text-sm">
            *Precios especiales por paquete. Pregunta por nuestras promociones semanales.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
