'use client'

import { FEATURE_FLAGS } from '@/lib/featureFlags'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Dog, MessageCircle, XCircle, Mail } from 'lucide-react'
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/components/ui/SocialIcons'
import { useConfig } from '@/context/ConfigContext'
import { formatBusinessHours } from '@/lib/defaultConfig'
import { confirmWhatsAppShare, formatDisplayPhone } from '@/lib/utils'
import { BRAND } from '@/lib/brand'
import { Logo } from '@/components/ui/Logo'

export default function Footer({ onTerms }: { onTerms: () => void }) {
  const { config } = useConfig()
  return (
    <footer className="relative border-t border-border bg-surface">
      <div className="section-container py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-4">
              <Logo size={40} />
              <span className="text-lg font-bold text-ink">
                PET <span className="text-primary">Ap</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Solicitudes y seguimiento de paseos caninos programados desde Familia PET.
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
                href={BRAND.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={(event) => {
                  event.preventDefault()
                  confirmWhatsAppShare(BRAND.whatsapp, 'Hola, solicito información sobre los paseos de PET Ap.')
                }}
              >
                <MessageCircle size={14} />
                {formatDisplayPhone(BRAND.whatsapp)}
              </a>
              <a
                href={`mailto:${config.contactEmail || BRAND.email}`}
                className="flex min-h-11 items-center gap-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Mail size={14} />
                {config.contactEmail || BRAND.email}
              </a>
              {/* La cancelación por teléfono está apagada; sin esto el enlace
                  lleva a una página que solo dice "no disponible". */}
              {FEATURE_FLAGS.PUBLIC_PHONE_CANCELLATION_ENABLED && (
                <Link href="/cancelar" className="flex min-h-11 items-center gap-2 text-sm text-muted transition-colors hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <XCircle size={14} />
                  Cancelar reserva
                </Link>
              )}
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
                { icon: WhatsAppIcon, href: BRAND.whatsappUrl, label: 'WhatsApp' },
                ...(config.instagram ? [                { icon: InstagramIcon, href: config.instagram, label: 'Instagram' }] : []),
                ...(config.facebook ? [{ icon: FacebookIcon, href: config.facebook, label: 'Facebook' }] : []),
                ...(config.tiktok ? [{ icon: TikTokIcon, href: config.tiktok, label: 'TikTok' }] : []),
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (abre en nueva ventana)`}
                  className="card flex h-11 w-11 items-center justify-center rounded-full text-muted transition-all duration-200 hover:scale-105 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none motion-reduce:transition-none"
                  onClick={(event) => {
                    if (label !== 'WhatsApp') return
                    event.preventDefault()
                    confirmWhatsAppShare(BRAND.whatsapp, 'Hola, solicito información sobre los paseos de PET Ap.')
                  }}
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
            <Link href="/nosotros" className="inline-flex min-h-11 items-center text-xs text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Nosotros
            </Link>
            <Link href="/preguntas-frecuentes" className="inline-flex min-h-11 items-center text-xs text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              FAQ
            </Link>
            <button onClick={onTerms} className="inline-flex min-h-11 items-center text-xs text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Términos
            </button>
            <Link href="/terminos" className="inline-flex min-h-11 items-center text-xs text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Términos completos
            </Link>
            <Link href="/privacidad" className="inline-flex min-h-11 items-center text-xs text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
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
