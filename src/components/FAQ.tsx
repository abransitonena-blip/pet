'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaChevronDown, FaQuestionCircle } from 'react-icons/fa'
import { useConfig } from '@/context/ConfigContext'

const faqs = config.faq.length > 0 ? config.faq.map((f: any) => ({ q: f.question, a: f.answer })) : [
  {
    q: '¿En qué horario realizan los paseos?',
    a: 'Operamos de Lunes a Sábado, de 7:00 AM a 7:00 PM. Los paseos se agendan según disponibilidad. Domingos solo con cita previa.',
  },
  {
    q: '¿Qué pasa si llueve?',
    a: 'En caso de lluvia ligera, el paseo se realiza normalmente (a los perros les encanta). Si hay tormenta o condiciones peligrosas, te contactaremos para reprogramar sin costo.',
  },
  {
    q: '¿Cómo funcionan las cancelaciones?',
    a: 'Puedes cancelar sin costo hasta 2 horas antes del paseo. Cancelaciones tardías o no-show pueden generar un cargo del 50%. Entendemos emergencias, háblanos.',
  },
  {
    q: '¿Pasean perros de todas las tallas?',
    a: '¡Claro! Desde chihuahuas hasta grandes daneses. Agrupamos por tamaño y temperamento para la seguridad de todos.',
  },
  {
    q: '¿Qué incluye el Paseo Premium?',
    a: 'Duración de 60 min con reporte detallado por WhatsApp, fotos, rastreo GPS, y ejercicios personalizados.',
  },
  {
    q: '¿Cómo pago?',
    a: 'Aceptamos efectivo, transferencia bancaria y depósito. El pago se acuerda al momento de agendar.',
  },
  {
    q: '¿Zona Quebrada es la única zona?',
    a: 'Sí, actualmente cubrimos exclusivamente Zona Quebrada en Cuautitlán. Esto nos permite dar un servicio más rápido y personalizado.',
  },
  {
    q: '¿Mi perro necesita estar vacunado?',
    a: 'Sí, pedimos que los perros estén al día con sus vacunas (múltiple y antirrábica) para la seguridad de todos los peludos.',
  },
]

export default function FAQ() {
  const { config } = useConfig()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">
            Resolvemos tus dudas
          </span>
          <h2 className="section-title mt-3">
            Preguntas <span className="gradient-text">frecuentes</span>
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full glass-card p-4 sm:p-5 text-left flex items-center justify-between gap-4 transition-all hover:bg-white/[0.03]"
              >
                <span className="flex items-center gap-3 text-sm sm:text-base font-medium text-white">
                  <FaQuestionCircle className="text-primary shrink-0" size={14} />
                  {faq.q}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0"
                >
                  <FaChevronDown className="text-white/30" size={12} />
                </motion.div>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 sm:px-5 pb-4 pt-2 text-sm text-white/50 leading-relaxed border-t border-white/5 mx-4 sm:mx-5">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
