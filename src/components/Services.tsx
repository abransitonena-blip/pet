'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  FaDog,
  FaCut,
  FaShower,
  FaHome,
  FaPaw,
  FaHeart,
} from 'react-icons/fa'

const services = [
  {
    icon: FaShower,
    title: 'Baño completo',
    description:
      'Baño con shampoo premium, secado, cepillado y limpieza de oídos.',
    price: '$150',
    duration: '40 min',
  },
  {
    icon: FaCut,
    title: 'Corte estético',
    description:
      'Corte profesional según la raza y necesidades de tu mascota.',
    price: '$250',
    duration: '60 min',
  },
  {
    icon: FaDog,
    title: 'Baño + Corte',
    description: 'Paquete completo de baño y corte estético a precio especial.',
    price: '$350',
    duration: '90 min',
  },
  {
    icon: FaHome,
    title: 'Guardería',
    description:
      'Cuida a tu mascota mientras trabajas. Incluye paseos y juegos.',
    price: '$200/día',
    duration: 'Todo el día',
  },
  {
    icon: FaPaw,
    title: 'Limpieza dental',
    description:
      'Limpieza dental profesional para prevenir enfermedades bucales.',
    price: '$180',
    duration: '30 min',
  },
  {
    icon: FaHeart,
    title: 'Spa Premium',
    description:
      'Todo el lujo que tu mascota merece. Hidratación, masajes y más.',
    price: '$450',
    duration: '120 min',
  },
  {
    icon: FaDog,
    title: 'Paseo diario',
    description:
      'Paseos supervisados en la Zona Quebrada para que tu mascota se ejercite.',
    price: '$80',
    duration: '30 min',
  },
  {
    icon: FaCut,
    title: 'Corte de uñas',
    description:
      'Corte seguro y profesional de uñas con lima incluida.',
    price: '$80',
    duration: '15 min',
  },
]

export default function Services() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="servicios" className="relative py-24 sm:py-32" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">
            Nuestros servicios
          </span>
          <h2 className="section-title mt-3">
            Precios{' '}
            <span className="gradient-text">accesibles</span>
          </h2>
          <p className="section-subtitle">
            Todos nuestros servicios están diseñados para darle el mejor cuidado
            a tu mascota sin que tengas que gastar de más.
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
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-purple-600/30 transition-all duration-300"
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
                    <span className="text-xs text-white/40">{service.duration}</span>
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
            *Precios especiales por paquete. Pregunta por nuestras promociones.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
