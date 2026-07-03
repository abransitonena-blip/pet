'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { FaTimes, FaDog } from 'react-icons/fa'

export default function TermsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 sm:p-8"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FaDog style={{ color: 'var(--primary)' }} className="text-xl" />
                <h2 className="text-xl font-bold">Términos y Condiciones</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
                style={{ color: 'var(--text-secondary)' }}
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <section>
                <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                  1. Servicio de Paseos Caninos
                </h3>
                <p>
                  Paseos Quebrada ofrece servicios de paseos supervisados para perros en Zona Quebrada, Cuautitlán. 
                  Todos los paseos son realizados por personal capacitado y con experiencia en manejo canino.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                  2. Reservaciones
                </h3>
                <p>
                  Las reservaciones se realizan a través de nuestro formulario web o directamente por WhatsApp al 
                  5523053772. La confirmación del servicio se envía vía WhatsApp.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                  3. Cancelaciones
                </h3>
                <p>
                  Las cancelaciones deben realizarse con al menos 2 horas de anticipación. 
                  Cancelaciones tardías pueden generar un cargo del 50% del servicio.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                  4. Responsabilidad
                </h3>
                <p>
                  Paseos Quebrada se compromete a cuidar de tu perro durante el paseo. 
                  El dueño es responsable de proporcionar información verídica sobre el comportamiento 
                  y salud de su mascota. No nos hacemos responsables por agresiones a otros perros 
                  o personas no declaradas previamente.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                  5. Salud y Vacunación
                </h3>
                <p>
                  Todos los perros deben contar con su esquema de vacunación al día para poder 
                  participar en paseos grupales. Para paseos individuales se recomienda pero no es 
                  obligatorio.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                  6. Privacidad
                </h3>
                <p>
                  Tus datos personales (nombre, teléfono, dirección) son utilizados únicamente 
                  para coordinar los servicios de paseo. No compartimos tu información con terceros.
                  Las fotos y videos tomados durante los paseos pueden ser usados en nuestra galería 
                  y redes sociales, a menos que solicites lo contrario.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                  7. Precios
                </h3>
                <p>
                  Los precios están expresados en pesos mexicanos (MXN) e incluyen IVA. 
                  Paseos Quebrada se reserva el derecho de modificar precios sin previo aviso, 
                  respetando las tarifas acordadas en reservaciones ya confirmadas.
                </p>
              </section>

              <section className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Última actualización: Julio 2024
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
