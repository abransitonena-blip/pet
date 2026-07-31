'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaWhatsapp, FaChevronDown, FaCalendarAlt, FaDog, FaCreditCard, FaPaw } from 'react-icons/fa'
import { WHATSAPP_NUMBER } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

const FAQ_ITEMS = [
  {
    category: 'Reservas',
    icon: FaCalendarAlt,
    questions: [
      { q: '¿Cómo puedo reservar un paseo?', a: 'Puedes reservar desde nuestra sección de cotización en la página principal o directamente desde tu cuenta. Solo elige el servicio, fecha, hora y datos de tu mascota.' },
      { q: '¿Puedo cancelar una reserva?', a: 'Sí, puedes cancelar sin costo hasta 2 horas antes del paseo. Cancelaciones tardías o no-show pueden generar un cargo del 50%. Entendemos emergencias, háblanos.' },
      { q: '¿Qué pasa si llueve el día del paseo?', a: 'En caso de lluvia ligera el paseo se realiza normalmente (a los perros les encanta). Si hay tormenta o condiciones peligrosas, reprogramamos sin costo.' },
      { q: '¿Puedo cambiar la fecha de mi reserva?', a: 'Sí, puedes reprogramar hasta 12 horas antes. Contáctanos por WhatsApp para coordinar la nueva fecha.' },
    ],
  },
  {
    category: 'Servicios',
    icon: FaDog,
    questions: [
      { q: '¿Qué incluye cada paseo?', a: 'Todos nuestros paseos incluyen: paseador certificado, agua fresca, bolsas para desechos y reporte de actividad. Los paquetes premium incluyen fotos y ruta personalizada.' },
      { q: '¿Cuánto dura cada paseo?', a: 'Ofrecemos paseos de 30 min (Cotidiano), 45 min (Energía) y 60 min (Acompañamiento). También hay planes de rutina semanal.' },
      { q: '¿Atienden a todos los tipos de perros?', a: 'Atendemos perros de todos los tamaños y razas. Agrupamos por tamaño y temperamento para la seguridad de todos.' },
      { q: '¿Puedo llevar a más de un perro?', a: 'El servicio Cotidiano incluye hasta 4 perros del mismo hogar. Para necesidades especiales, contáctanos por WhatsApp.' },
    ],
  },
  {
    category: 'Pagos',
    icon: FaCreditCard,
    questions: [
      { q: '¿Cómo puedo pagar?', a: 'Aceptamos efectivo, transferencia bancaria y depósito digital. El pago se acuerda al momento de agendar.' },
      { q: '¿Tienen promociones o descuentos?', a: 'Ofrecemos descuentos en paquetes semanales y mensuales. También tenemos un programa de lealtad donde acumulas puntos por cada paseo.' },
      { q: '¿Ofrecen reembolsos?', a: 'Si cancelas con más de 2 horas de anticipación, no hay cargo. Cancelaciones tardías pueden generar un cargo del 50%.' },
    ],
  },
  {
    category: 'Mascotas',
    icon: FaPaw,
    questions: [
      { q: '¿Cómo registro a mi mascota?', a: 'Crea una cuenta y agrega los datos de tu peludo: nombre, raza, tamaño, edad y notas importantes para el paseador.' },
      { q: '¿Qué información necesito proporcionar?', a: 'Nombre, raza, tamaño, peso aproximado, edad, si tiene alguna condición médica y contactos de emergencia veterinaria.' },
      { q: '¿Mi perro necesita estar vacunado?', a: 'Sí, pedimos que los perros estén al día con sus vacunas (múltiple y antirrábica) para la seguridad de todos.' },
      { q: '¿Puedo ver fotos del paseo?', a: '¡Sí! Después de cada paseo recibirás fotos de tu mascota disfrutando y un reporte de actividad.' },
    ],
  },
]

export default function PublicFAQ() {
  const [openIndex, setOpenIndex] = useState<string | null>(null)

  const toggle = (key: string) => setOpenIndex((prev) => prev === key ? null : key)

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">
            Resolvemos tus dudas
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3 text-ink">
            Preguntas <span className="gradient-text">frecuentes</span>
          </h1>
          <p className="mt-4 text-muted text-base sm:text-lg max-w-xl mx-auto">
            Todo lo que necesitas saber sobre nuestros servicios de paseo canino
          </p>
        </div>
      </section>

      {/* FAQ List */}
      <section className="pb-24 sm:pb-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {FAQ_ITEMS.map((section) => {
            const Icon = section.icon
            return (
              <div key={section.category}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                    <Icon size={14} className="text-primary" />
                  </div>
                  <h2 className="text-lg font-bold text-ink">{section.category}</h2>
                </div>
                <div className="space-y-2">
                  {section.questions.map((item) => {
                    const key = `${section.category}-${item.q}`
                    const isOpen = openIndex === key
                    return (
                      <div
                        key={key}
                        className="card overflow-hidden"
                      >
                        <button
                          onClick={() => toggle(key)}
                          className="w-full px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between text-left"
                          aria-expanded={isOpen}
                          aria-controls={`faq-answer-${key}`}
                        >
                          <span className="text-sm sm:text-base font-medium text-ink pr-4">{item.q}</span>
                          <motion.div
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="shrink-0 text-muted"
                          >
                            <FaChevronDown size={12} />
                          </motion.div>
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              id={`faq-answer-${key}`}
                              role="region"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 text-sm leading-relaxed text-muted border-t border-border">
                                <div className="pt-3">
                                  {item.a}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Contact CTA */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
          <div className="card p-6 sm:p-8 text-center">
            <p className="text-base sm:text-lg font-semibold text-ink mb-2">
              ¿No encontraste lo que buscabas?
            </p>
            <p className="text-sm text-muted mb-5">
              Estamos aquí para ayudarte
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola, tengo una pregunta sobre los paseos')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              <FaWhatsapp size={16} /> Escríbenos por WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
