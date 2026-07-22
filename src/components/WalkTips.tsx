'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FaLightbulb, FaPaw, FaDog, FaHeart, FaShieldAlt, FaBone } from 'react-icons/fa'
import { useConfig } from '@/context/ConfigContext'

const DEFAULT_TIPS = [
  { icon: FaDog, title: 'Hidratación antes del paseo', text: 'Ofrécele agua fresca 30 minutos antes del paseo. Evita que tome demasiada justo antes para prevenir molestias estomacales.' },
  { icon: FaPaw, title: 'Revisa sus almohadillas', text: 'En días calurosos el asfalto quema. Toca el suelo con tu mano: si está muy caliente para ti, también para él. Mejor camina por pasto o tierra.' },
  { icon: FaHeart, title: 'Identificación siempre', text: 'Asegúrate que tu perro tenga placa con tu número de teléfono. Un microchip es aún mejor por si se pierde la placa.' },
  { icon: FaShieldAlt, title: 'Vacunas al día', text: 'Mantén al corriente la vacuna múltiple y antirrábica. También recomendamos desparasitación trimestral.' },
  { icon: FaBone, title: 'Premios y refuerzo positivo', text: 'Usa premios para reforzar buen comportamiento durante el paseo. Esto hace que tu perro asocie el paseo con algo positivo.' },
  { icon: FaLightbulb, title: 'Rutina consistente', text: 'Los perros se sienten más seguros con horarios regulares. Intentar sacarlo a la misma hora ayuda a su equilibrio físico y emocional.' },
]

export default function WalkTips() {
  const { config } = useConfig()
  const tips = config.walkTips.length > 0 ? config.walkTips : DEFAULT_TIPS
  return (
    <section className="relative py-24 sm:py-32">
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">
            Tips para tu peludo
          </span>
          <h2 className="section-title mt-3">
            Consejos <span className="gradient-text">caninos</span>
          </h2>
          <p className="section-subtitle">
            Pequeñas acciones que hacen la diferencia en la salud y felicidad de tu perro
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tips.map((tip, i) => {
            const Icon = tip.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="glass-card p-5 sm:p-6 hover:bg-white/[0.03] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center mb-4">
                  {typeof Icon === 'string' ? <span className="text-white text-lg">{Icon}</span> : <Icon className="text-white" size={16} />}
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{tip.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{tip.text}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
