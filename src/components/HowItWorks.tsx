'use client'

import { motion } from 'framer-motion'
import { FaWhatsapp, FaDog, FaWalking, FaMapMarkerAlt, FaHeart } from 'react-icons/fa'

const steps = [
  {
    icon: FaWhatsapp,
    title: '1. Contáctanos',
    description:
      'Escríbenos por WhatsApp o llena el formulario con los datos de tu perro y el paquete que prefieras.',
  },
  {
    icon: FaDog,
    title: '2. Conocemos a tu perro',
    description:
      'Agendamos una breve visita para conocer a tu lomito, sus necesidades y su personalidad.',
  },
  {
    icon: FaWalking,
    title: '3. ¡A pasear!',
    description:
      'Pasamos por tu perro, lo llevamos a pasear por Zona Quebrada, juega, corre y se divierte.',
  },
  {
    icon: FaMapMarkerAlt,
    title: '4. Lo regresamos a casa',
    description:
      'Regresamos a tu perro sano, feliz y cansado. Te enviamos fotos y un reporte del paseo.',
  },
  {
    icon: FaHeart,
    title: '5. Repite cuando quieras',
    description:
      'Agenda el siguiente paseo desde WhatsApp. Tu perro te lo va a pedir todos los días.',
  },
]

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span
            className="text-sm uppercase tracking-widest font-medium"
            style={{ color: "rgba(230, 126, 34, 0.8)" }}
          >
            Cómo funciona
          </span>
          <h2 className="section-title mt-3">
            Así de <span className="gradient-text">fácil</span> es
          </h2>
          <p className="section-subtitle">
            En solo 5 pasos tu perro estará disfrutando de su paseo por Zona Quebrada.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-card p-6 text-center relative group"
              >
                {i < steps.length - 1 && (
                  <div
                    className="hidden xl:block absolute top-1/2 -right-3 z-10 text-2xl"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    →
                  </div>
                )}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-xl"
                  style={{
                    background: `linear-gradient(135deg, var(--primary), #D35400)`,
                  }}
                >
                  <Icon />
                </motion.div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {step.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
