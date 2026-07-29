'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { FaDog, FaWhatsapp, FaInstagram, FaFacebook, FaTimes, FaEnvelope, FaTiktok } from 'react-icons/fa'
import { useConfig } from '@/context/ConfigContext'
import { formatBusinessHours } from '@/lib/defaultConfig'
import { BRAND } from '@/lib/brand'

export default function Footer({ onTerms }: { onTerms: () => void }) {
  const { config } = useConfig()
  return (
    <footer
      className="relative"
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-primary)',
      }}
    >
      <div className="section-container py-16">
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
                <span className="text-brand-400">PET Ap</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Paseos personalizados con fotos y reporte de cada paseo.
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
              {formatBusinessHours().map((h) => (
                <p key={h.weekday} className="flex justify-between">
                  <span>{h.weekday}</span>
                  <span>{h.hours}</span>
                </p>
              ))}
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
                href={`https://wa.me/${config.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-green-400 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <FaWhatsapp size={14} />
                {`+52 ${config.whatsapp.slice(3, 5)} ${config.whatsapp.slice(5, 9)} ${config.whatsapp.slice(9)}`}
              </a>
              <a
                href={`mailto:${BRAND.email}`}
                className="flex items-center gap-2 hover:text-brand-400 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <FaEnvelope size={14} />
                {BRAND.email}
              </a>
              <Link href="/cancelar" className="flex items-center gap-2 hover:text-red-400 transition-colors text-sm" style={{ color: 'var(--text-secondary)' }}>
                <FaTimes size={14} />
                Cancelar reserva
              </Link>
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
                { icon: FaWhatsapp, href: `https://wa.me/${config.whatsapp}`, color: 'hover:text-green-400', label: 'WhatsApp' },
                ...(config.instagram ? [{ icon: FaInstagram, href: config.instagram, color: 'hover:text-pink-400', label: 'Instagram' }] : []),
                ...(config.facebook ? [{ icon: FaFacebook, href: config.facebook, color: 'hover:text-blue-400', label: 'Facebook' }] : []),
                ...(config.tiktok ? [{ icon: FaTiktok, href: config.tiktok, color: 'hover:text-white', label: 'TikTok' }] : []),
              ].map(({ icon: Icon, href, color, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (abre en nueva ventana)`}
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
              &copy; {new Date().getFullYear()} PET Ap. Todos los derechos reservados.
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
              Hecho con <FaDog style={{ color: 'var(--primary)' }} className="inline" size={10} /> para los perros
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
