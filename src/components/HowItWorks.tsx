'use client'

import { motion } from 'framer-motion'
import { LogIn, CalendarCheck, PawPrint, Eye } from 'lucide-react'

const steps = [
  { icon: LogIn, title: '1. Entra a Familia PET', description: 'Registra a tu perro y una dirección segura.' },
  { icon: CalendarCheck, title: '2. Solicita o agenda', description: 'Elige servicio, fecha y ventana de llegada.' },
  { icon: PawPrint, title: '3. Recibe un paseador compatible', description: 'PET Ap valida zona, disponibilidad y compatibilidad.' },
  { icon: Eye, title: '4. Sigue el paseo', description: 'Consulta estados, fotografías y reporte desde tu cuenta.' },
]

export default function HowItWorks() {
  return (
    <section aria-label="Cómo funciona" id="como-funciona" className="relative py-24 sm:py-32">
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.32 }}
          className="text-center mb-12"
        >
          <span className="text-sm uppercase tracking-widest font-medium text-primary-hover">Cómo funciona</span>
          <h2 className="section-title mt-3">
            Así de <span className="text-primary">fácil</span> es
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="card p-5 text-center relative"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.22 }}
                  className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-primary text-white"
                >
                  <Icon size={20} />
                </motion.div>
                <h3 className="text-sm font-semibold mb-1.5 text-ink">{step.title}</h3>
                <p className="text-xs leading-relaxed text-muted">
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
