'use client'

import { motion } from 'framer-motion'
import { FaDog, FaMapMarkerAlt, FaWhatsapp, FaInstagram, FaFacebook } from 'react-icons/fa'

export default function Footer({ onTerms }: { onTerms: () => void }) {
  return (
    <footer
      className="relative"
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-primary)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white font-bold">
                <FaDog />
              </div>
              <span className="text-lg font-bold">
                <span className="gradient-text">Paseos Quebrada</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Paseos caninos supervisados en Zona Quebrada, Cuautitlán.
              Precios accesibles, mucho amor y ejercicio para tu perro.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-primary)' }}>
              Horarios de paseos
            </h3>
            <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <p className="flex justify-between">
                <span>Lun - Vie</span>
                <span>7:00 - 20:00</span>
              </p>
              <p className="flex justify-between">
                <span>Sábado</span>
                <span>8:00 - 18:00</span>
              </p>
              <p className="flex justify-between">
                <span>Domingo</span>
                <span>9:00 - 14:00</span>
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-primary)' }}>
              Contacto
            </h3>
            <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <a
                href="https://wa.me/5215523053772"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-green-400 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <FaWhatsapp size={14} />
                5523053772
              </a>
              <p className="flex items-center gap-2">
                <FaMapMarkerAlt size={14} style={{ color: 'var(--primary)' }} />
                Zona Quebrada, Cuautitlán
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-primary)' }}>
              Síguenos
            </h3>
            <div className="flex gap-3">
              {[
                { icon: FaWhatsapp, href: 'https://wa.me/5215523053772', color: 'hover:text-green-400' },
                { icon: FaInstagram, href: '#', color: 'hover:text-pink-400' },
                { icon: FaFacebook, href: '#', color: 'hover:text-blue-400' },
              ].map(({ icon: Icon, href, color }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-10 h-10 rounded-full glass flex items-center justify-center transition-all duration-300 hover:scale-110 ${color}`}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            © 2024 Paseos Quebrada. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={onTerms}
              className="text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              Términos y condiciones
            </button>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Hecho con <FaDog style={{ color: 'var(--primary)' }} className="inline" size={10} /> para los
              perros de Cuautitlán
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
