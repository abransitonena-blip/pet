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

const services = [
  {
    icon: FaWalking,
    title: 'Paseo Individual',
    description:
      'Paseo personalizado de 30 min para tu perro. Atención 1 a 1, ruta por Zona Quebrada.',
    price: '$80',
    duration: '30 min',
  },
  {
    icon: FaClock,
    title: 'Paseo Plus',
    description:
      'Paseo extendido de 1 hora con juegos, ejercicios y mucho tiempo al aire libre.',
    price: '$130',
    duration: '60 min',
  },
  {
    icon: FaUsers,
    title: 'Paseo Grupal',
    description:
      'Paseo en grupo supervisado. Tu perro socializa mientras se ejercita con amigos.',
    price: '$60',
    duration: '45 min',
  },
  {
    icon: FaTree,
    title: 'Ruta Premium',
    description:
      'Ruta especial por zonas arboladas de Cuautitlán. Tu perro explora y se divierte.',
    price: '$180',
    duration: '90 min',
  },
  {
    icon: FaSun,
    title: 'Paquete Semanal',
    description:
      '5 paseos individuales a la semana. Precio especial por paquete. ¡Ahorra!',
    price: '$350',
    duration: '5 paseos',
  },
  {
    icon: FaStar,
    title: 'Paquete Mensual',
    description:
      'Paseos diarios (lun-vie) durante un mes. La mejor opción para dueños ocupados.',
    price: '$1,200',
    duration: '20 paseos',
  },
  {
    icon: FaDog,
    title: 'Paseo + Reporte',
    description:
      'Paseo individual + fotos y video de tu perro durante el paseo. Llega reporte por WhatsApp.',
    price: '$150',
    duration: '45 min',
  },
  {
    icon: FaPaw,
    title: 'Paseo Express',
    description:
      'Paseo rápido de 20 min para necesidades básicas. Ideal para emergencias.',
    price: '$60',
    duration: '20 min',
  },
]

export default function Services() {
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
          {services.map((service, i) => {
            const Icon = service.icon
            return (
              <motion.div
                key={service.title}
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
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-amber-600/20 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-amber-600/30 transition-all duration-300"
                  >
                    <Icon className="text-xl text-primary" />
                  </motion.div>

                  <h3 className="text-lg font-semibold text-white mb-2">
                    {service.title}
                  </h3>
                  <p className="text-sm text-white/50 mb-4 leading-relaxed">
                    {service.description}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-2xl font-bold gradient-text">
                      {service.price}
                    </span>
                    <span className="text-xs text-white/40 flex items-center gap-1">
                      <FaClock size={10} />
                      {service.duration}
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
