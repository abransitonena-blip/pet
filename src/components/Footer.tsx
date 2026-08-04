'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Dog, MessageCircle, XCircle, Mail, Music } from 'lucide-react'
import { FacebookIcon, InstagramIcon } from '@/components/ui/SocialIcons'
import { useConfig } from '@/context/ConfigContext'
import { formatBusinessHours } from '@/lib/defaultConfig'
import { formatDisplayPhone } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

export default function Footer({ onTerms }: { onTerms: () => void }) {
  const { config } = useConfig()
  return (
    <footer className="relative border-t border-border bg-surface">
      <div className="section-container py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
                <Dog size={18} />
              </div>
              <span className="text-lg font-bold text-ink">
                PET <span className="text-primary">Ap</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted">
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
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-ink">Horarios de paseos</h3>
            <div className="space-y-2 text-sm text-muted">
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
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-ink">Contacto</h3>
            <div className="space-y-3 text-sm text-muted">
              <a
                href={`https://wa.me/${config.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <MessageCircle size={14} />
                {formatDisplayPhone(config.whatsapp)}
              </a>
              <a
                href={`mailto:${config.contactEmail || BRAND.email}`}
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Mail size={14} />
                {config.contactEmail || BRAND.email}
              </a>
              <Link href="/cancelar" className="flex items-center gap-2 hover:text-error transition-colors text-sm text-muted">
                <XCircle size={14} />
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
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-ink">Síguenos</h3>
            <div className="flex gap-3">
              {[
                { icon: MessageCircle, href: `https://wa.me/${config.whatsapp}`, label: 'WhatsApp' },
                ...(config.instagram ? [                { icon: InstagramIcon, href: config.instagram, label: 'Instagram' }] : []),
                ...(config.facebook ? [{ icon: FacebookIcon, href: config.facebook, label: 'Facebook' }] : []),
                ...(config.tiktok ? [{ icon: Music, href: config.tiktok, label: 'TikTok' }] : []),
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (abre en nueva ventana)`}
                  className="w-10 h-10 rounded-full card flex items-center justify-center transition-all duration-300 hover:scale-110 text-muted hover:text-primary"
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
          className="mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border"
        >
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} PET Ap. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link href="/nosotros" className="text-xs text-muted hover:text-ink transition-colors">
              Nosotros
            </Link>
            <Link href="/preguntas-frecuentes" className="text-xs text-muted hover:text-ink transition-colors">
              FAQ
            </Link>
            <button onClick={onTerms} className="text-xs text-muted hover:text-ink transition-colors">
              Términos
            </button>
            <Link href="/terminos" className="text-xs text-muted hover:text-ink transition-colors">
              Términos completos
            </Link>
            <Link href="/privacidad" className="text-xs text-muted hover:text-ink transition-colors">
              Privacidad
            </Link>
            <p className="text-xs text-muted">
              Hecho con <Dog className="inline text-primary" size={10} /> para los perros
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
