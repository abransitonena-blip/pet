'use client'

import { motion } from 'framer-motion'
import { LogIn, CalendarCheck, PawPrint, Eye } from 'lucide-react'

// Cada paso dice lo que la app hace de verdad hoy: la zona sale del código
// postal, el aviso de salida de zona existe, y las fotos llegan cuando el
// paseador las sube.
const steps = [
  { icon: LogIn, title: '1. Entra a Familia PET', description: 'Registra a tu perro con sus cuidados y tu dirección. Tu código postal define tu zona.' },
  { icon: CalendarCheck, title: '2. Agenda el paseo', description: 'Eliges el plan, el día y la ventana de llegada que te acomoda.' },
  { icon: PawPrint, title: '3. Te asignamos un paseador', description: 'Alguien de tu zona, con perfil activo y horario libre a esa hora.' },
  { icon: Eye, title: '4. Síguelo y recibe su reporte', description: 'Durante el paseo avisamos si sale de tu zona; al terminar llega la bitácora, con fotos si el paseador las subió.' },
]

export default function HowItWorks() {
  return (
    <section aria-label="Cómo funciona" id="como-funciona" className="relative scroll-mt-20 py-24 sm:py-32">
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
