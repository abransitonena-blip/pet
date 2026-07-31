'use client'

import { motion } from 'framer-motion'
import { FileText, Dog, Footprints, MapPin, Heart } from 'lucide-react'

const steps = [
  { icon: FileText, title: '1. Contáctanos', description: 'Llena el formulario con los datos de tu perro y el paquete que prefieras. ¡Es muy fácil!' },
  { icon: Dog, title: '2. Conocemos a tu perro', description: 'Agendamos una breve visita para conocer a tu lomito, sus necesidades y su personalidad.' },
  { icon: Footprints, title: '3. ¡A pasear!', description: 'Pasamos por tu perro, lo llevamos a pasear, juega, corre y se divierte.' },
  { icon: MapPin, title: '4. Lo regresamos a casa', description: 'Regresamos a tu perro sano, feliz y cansado. Te enviamos fotos y un reporte del paseo.' },
  { icon: Heart, title: '5. Repite cuando quieras', description: 'Agenda el siguiente paseo desde tu cuenta. Tu perro te lo va a pedir todos los días.' },
]

export default function HowItWorks() {
  return (
    <section aria-label="Cómo funciona" id="como-funciona" className="relative py-24 sm:py-32">
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm uppercase tracking-widest font-medium text-primary">Cómo funciona</span>
          <h2 className="section-title mt-3">
            Así de <span className="text-primary">fácil</span> es
          </h2>
          <p className="section-subtitle">
            En solo 6 pasos tu perro estará disfrutando de su paseo.
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
                className="card p-6 text-center relative group"
              >
                {i < steps.length - 1 && (
                  <div className="hidden xl:block absolute top-1/2 -right-3 z-10 text-xl text-muted">→</div>
                )}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-primary text-white"
                >
                  <Icon size={22} />
                </motion.div>
                <h3 className="font-semibold mb-2 text-ink">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted">
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
