'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { FaTimes, FaDog, FaShieldAlt, FaHeart, FaWhatsapp, FaLock, FaPaw, FaCalendarAlt, FaStar } from 'react-icons/fa'

const sections = [
  {
    icon: FaDog,
    title: 'Nuestro compromiso contigo',
    content: 'En Paseos Quebrada nos apasiona lo que hacemos. Cada paseo es una experiencia pensada para la felicidad y el bienestar de tu perro. Nuestro equipo está capacitado en manejo canino y primeros auxilios básicos, para que tú estés tranquilo mientras tu lomito se divierte.',
  },
  {
    icon: FaCalendarAlt,
    title: '¿Cómo reservar?',
    content: 'Reservar es muy fácil: llena el formulario en nuestra página o escríbenos directo por WhatsApp al 5523053772. Te confirmaremos el horario disponible y listo. En temporada alta te recomendamos reservar con al menos 24 horas de anticipación para asegurar tu lugar.',
  },
  {
    icon: FaTimes,
    title: 'Cancelaciones y cambios',
    content: 'Entendemos que pasan imprevistos. Puedes cancelar o reagendar sin costo hasta 2 horas antes del paseo desde nuestra página de cancelación o por WhatsApp. Si cancelas después de ese tiempo, te cobraremos el 50% del servicio para cubrir el tiempo apartado.',
  },
  {
    icon: FaHeart,
    title: 'Salud y seguridad',
    content: 'La salud de tu perro es lo más importante. Todos los perros deben tener su esquema de vacunación al día para paseos grupales. Para paseos individuales lo recomendamos pero no es obligatorio. Si tu perro tiene alguna condición especial, comportamiento agresivo, o está en celo, por favor infórmanos al agendar para tomar las precauciones necesarias. Así todos disfrutan el paseo.',
  },
  {
    icon: FaShieldAlt,
    title: 'Responsabilidad compartida',
    content: 'Nos comprometemos a cuidar a tu perro como si fuera nuestro. Durante el paseo usamos correa y supervisión constante. Tú como dueño te comprometes a proporcionar información honesta sobre el comportamiento, salud y necesidades de tu mascota. No nos hacemos responsables por incidentes derivados de información no revelada, como agresividad no declarada o condiciones médicas preexistentes.',
  },
  {
    icon: FaLock,
    title: 'Tu privacidad importa',
    content: 'Tus datos personales (nombre, teléfono, dirección) los usamos únicamente para coordinar los paseos. No compartimos información con terceros ni enviamos spam. Las fotos y videos que tomamos durante los paseos son el alma de nuestra galería — si prefieres que no aparezca tu perro, solo dínoslo y lo respetamos sin problema.',
  },
  {
    icon: FaStar,
    title: 'Precios justos',
    content: 'Todos nuestros precios están en pesos mexicanos (MXN) e incluyen IVA. Creemos en precios accesibles para la comunidad de Zona Quebrada, Cuautitlán. Si algún día ajustamos nuestras tarifas, respetamos el precio acordado en reservaciones ya confirmadas. Los cupones y descuentos tienen vigencia y términos específicos que se indican al momento de aplicarlos.',
  },
  {
    icon: FaWhatsapp,
    title: 'Atención al cliente',
    content: 'Estamos disponibles por WhatsApp de lunes a sábado de 7:00 AM a 8:00 PM, y domingos de 9:00 AM a 2:00 PM. Fuera de horario puedes dejarnos un mensaje y te responderemos en cuanto abramos. Tu opinión nos ayuda a mejorar — después de cada paseo puedes calificar el servicio y dejar tus comentarios.',
  },
]

export default function TermsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 sm:p-8"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white">
                  <FaDog />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Términos y condiciones</h2>
                  <p className="text-xs text-white/40">Paseos Quebrada — Zona Quebrada, Cuautitlán</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/40 hover:text-white"
              >
                <FaTimes size={14} />
              </button>
            </div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.08 } },
              }}
              className="space-y-5"
            >
              {sections.map((section, i) => {
                const Icon = section.icon
                return (
                  <motion.div
                    key={i}
                    variants={{
                      hidden: { opacity: 0, y: 15 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    className="glass p-4 rounded-xl"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="text-primary" size={14} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-white mb-1.5">{section.title}</h3>
                        <p className="text-sm text-white/60 leading-relaxed">{section.content}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <p className="text-[10px] text-white/30">Última actualización: Julio 2024</p>
              <button
                onClick={onClose}
                className="text-xs px-4 py-2 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-all"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
