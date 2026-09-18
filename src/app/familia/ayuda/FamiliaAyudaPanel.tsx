'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ChevronDown, Mail, Search,
  CalendarDays, Dog, CreditCard, PawPrint, HelpCircle } from 'lucide-react'
import { confirmWhatsAppShare, WHATSAPP_NUMBER } from '@/lib/utils'
import { BRAND } from '@/lib/brand'
import { Button, Card } from '@/components/ui'
import { WhatsAppIcon } from '@/components/ui/SocialIcons'
import FeedbackWidget from '@/components/family/FeedbackWidget'

const FAQ_ITEMS = [
  {
    category: 'Reservas',
    icon: CalendarDays,
    color: '#D97706',
    questions: [
      {
        q: '¿Cómo puedo reservar un paseo?',
        a: 'Puedes reservar desde la sección "Nueva reserva" en tu cuenta. Solo elige el servicio, fecha, hora y datos de tu mascota. Te contactaremos por WhatsApp para confirmar.',
      },
      {
        q: '¿Puedo cancelar una reserva?',
        a: 'Sí, puedes cancelar hasta 24 horas antes del paseo sin costo. Si cancelas con menos de 24 horas, se aplicará un cargo del 50% del servicio.',
      },
      {
        q: '¿Qué pasa si llueve el día del paseo?',
        a: 'En caso de lluvia intensa, reprogramamos el paseo sin costo adicional. Te avisaremos por WhatsApp con anticipación.',
      },
      {
        q: '¿Puedo cambiar la fecha de mi reserva?',
        a: 'Sí, puedes reprogramar hasta 12 horas antes del paseo. Contáctanos por WhatsApp para coordinar la nueva fecha.',
      },
    ],
  },
  {
    category: 'Servicios',
    icon: Dog,
    color: '#059669',
    questions: [
      {
        q: '¿Qué incluye cada paseo?',
        a: 'La duración, alcance e instrucciones operativas se muestran antes de solicitar el paseo. El equipo confirma disponibilidad y detalles antes de prestar el servicio.',
      },
      {
        q: '¿Cuánto dura cada paseo?',
        a: 'El Paseo Individual dura 30 minutos, el Pack Semanal 45 minutos por sesión, y los paquetes mensuales incluyen sesiones de 45-60 minutos según el plan elegido.',
      },
      {
        q: '¿Atienden a todos los tipos de perros?',
        a: 'Atendemos perros de todos los tamaños y razas. Para perros con necesidades especiales, contáctanos antes de reservar para coordinar la mejor atención.',
      },
      {
        q: '¿Puedo llevar a más de un perro?',
        a: 'El servicio está diseñado para un perro por sesión. Si tienes varios peludos, podemos crear un plan personalizado. Escríbenos por WhatsApp.',
      },
    ],
  },
  {
    category: 'Pagos',
    icon: CreditCard,
    color: '#7C3AED',
    questions: [
      {
        q: '¿Cómo puedo pagar?',
        a: 'Aceptamos transferencia bancaria, efectivo y pago digital. El pago se realiza después de confirmar la reserva por WhatsApp.',
      },
      {
        q: '¿Tienen promociones o descuentos?',
        a: 'Sí, ofrecemos descuentos en paquetes semanales y mensuales. También tenemos un programa de lealtad donde acumulas puntos por cada paseo.',
      },
      {
        q: '¿Ofrecen reembolsos?',
        a: 'Si cancelas con más de 24 horas de anticipación, recibes reembolso completo. Cancelaciones con menos de 24 horas tienen un cargo del 50%.',
      },
    ],
  },
  {
    category: 'Mascotas',
    icon: PawPrint,
    color: '#EC4899',
    questions: [
      {
        q: '¿Cómo registro a mi mascota?',
        a: 'Ve a "Mis perros" en tu cuenta y agrega los datos de tu peludo: nombre, raza, tamaño, edad y notas importantes para el paseador.',
      },
      {
        q: '¿Qué información necesito proporcionar?',
        a: 'Nombre, raza, tamaño, peso aproximado, edad, si tiene algúna condición médica y contactos de emergencia veterinaria.',
      },
      {
        q: '¿Puedo ver fotos del paseo?',
        a: '¡Sí! Después de cada paseo recibirás una foto de tu mascota disfrutando. También puedes ver el historial de fotos en tu cuenta.',
      },
    ],
  },
]

export default function AyudaPage() {
  const router = useRouter()
  const [openIndex, setOpenIndex] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const toggle = (key: string) => setOpenIndex((prev) => prev === key ? null : key)

  const normalizedSearch = search.trim().toLowerCase()
  const visibleSections = normalizedSearch
    ? FAQ_ITEMS.map((section) => ({
        ...section,
        questions: section.questions.filter((item) =>
          item.q.toLowerCase().includes(normalizedSearch) || item.a.toLowerCase().includes(normalizedSearch)
        ),
      })).filter((section) => section.questions.length > 0)
    : FAQ_ITEMS

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="icon" onClick={() => router.push('/familia')} aria-label="Volver al inicio de Familia PET">
          <ArrowLeft size={14} />
        </Button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Centro de ayuda</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Encuentra respuestas a tus preguntas</p>
        </div>
      </div>

      {/* Quick Contact */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => confirmWhatsAppShare(WHATSAPP_NUMBER, 'Hola, necesito ayuda con mi cuenta de PET Ap.')}
          className="rounded-2xl p-4 text-left transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.1), rgba(5,150,105,0.05))', border: '1px solid var(--border)' }}
        >
          <WhatsAppIcon width={20} height={20} className="text-success-400 mb-2" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>WhatsApp</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Contacto sujeto a disponibilidad</p>
        </button>
        <a
          href={`mailto:${BRAND.email}?subject=Ayuda%20PET%20Ap`}
          className="rounded-2xl p-4 text-left transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(124,58,237,0.05))', border: '1px solid var(--border)' }}
        >
          <Mail size={20} className="text-violet-400 mb-2" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Email</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{BRAND.email}</p>
        </a>
      </div>

      {/* FAQ Search */}
      <label htmlFor="faq-search" className="relative block">
        <span className="sr-only">Buscar en preguntas frecuentes</span>
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <input
          id="faq-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar una pregunta…"
          className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
      </label>

      {normalizedSearch && visibleSections.length === 0 && (
        <p role="status" className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Sin resultados para &quot;{search.trim()}&quot;. Escríbenos por WhatsApp si no encuentras tu respuesta.
        </p>
      )}

      {/* FAQ Sections */}
      {visibleSections.map((section) => {
        const Icon = section.icon
        return (
          <div key={section.category}>
            <div className="flex items-center gap-2 mb-3">
              <Icon size={14} style={{ color: section.color }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{section.category}</h2>
            </div>
            <div className="space-y-1">
              {section.questions.map((item) => {
                const key = `${section.category}-${item.q}`
                const isOpen = openIndex === key
                return (
                  <Card
                    key={key}
                    className="overflow-hidden transition-colors"
                  >
                    <button
                      onClick={() => toggle(key)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors hover:bg-ink/5"
                    >
                      <span className="text-sm font-medium pr-4" style={{ color: 'var(--text-primary)' }}>{item.q}</span>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.22 }}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <ChevronDown size={12} />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {item.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Still need help */}
      <Card className="p-6 text-center">
        <HelpCircle className="text-2xl mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>¿No encontraste lo que buscabas?</p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Estamos aquí para ayudarte</p>
        <Button
          size="sm"
          onClick={() => confirmWhatsAppShare(WHATSAPP_NUMBER, 'Hola, tengo una pregunta que no encontré en el centro de ayuda.')}
          leftIcon={<WhatsAppIcon width={14} height={14} />}
        >
          Escribirnos por WhatsApp
        </Button>
      </Card>

      <FeedbackWidget />
    </div>
  )
}
