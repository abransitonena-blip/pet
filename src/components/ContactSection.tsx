'use client'

import { motion } from 'framer-motion'
import { useConfig } from '@/context/ConfigContext'
import { MessageCircle, Mail, Clock, Music, Phone } from 'lucide-react'
import { FacebookIcon, InstagramIcon } from '@/components/ui/SocialIcons'
import { formatBusinessHours } from '@/lib/defaultConfig'
import { confirmWhatsAppShare, formatDisplayPhone } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

export default function ContactSection() {
  const { config } = useConfig()

  const contacts = [
    { icon: MessageCircle, label: 'WhatsApp', value: formatDisplayPhone(BRAND.whatsapp), href: BRAND.whatsappUrl },
    { icon: Phone, label: 'Llamar', value: BRAND.displayPhone, href: BRAND.telUrl },
    { icon: Mail, label: 'Correo electrónico', value: config.contactEmail || BRAND.email, href: `mailto:${config.contactEmail || BRAND.email}` },
    { icon: Clock, label: 'Horario', value: formatBusinessHours().map((h) => `${h.weekday} ${h.hours}`).join(' · '), href: null },
  ]

  const socials = [
    ...(config.facebook ? [{ icon: FacebookIcon, label: 'Facebook', href: config.facebook }] : []),
    ...(config.instagram ? [{ icon: InstagramIcon, label: 'Instagram', href: config.instagram }] : []),
    ...(config.tiktok ? [{ icon: Music, label: 'TikTok', href: config.tiktok }] : []),
  ]

  return (
    <section aria-label="Contacto" id="contacto" className="relative py-24 sm:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.32 }}
          className="text-center mb-12"
        >
          <span className="text-primary-hover text-sm uppercase tracking-widest font-medium">Contáctanos</span>
          <h2 className="section-title mt-3">
            Estamos <span className="text-primary">aquí</span>
          </h2>
          <p className="section-subtitle">
            Paseos personalizados. Siempre listos para consentir a tu peludo.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-3"
        >
          {contacts.map((c, i) => {
            const Icon = c.icon
            const content = (
              <div className="card p-4 flex items-center gap-4 hover:border-hover transition-all">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted">{c.label}</p>
                  <p className="break-words text-sm font-medium leading-relaxed text-ink">{c.value}</p>
                </div>
              </div>
            )
            return c.href ? (
              <a key={i} href={c.href} target={c.href.startsWith('https://') ? '_blank' : undefined} rel={c.href.startsWith('https://') ? 'noopener noreferrer' : undefined} aria-label={c.href.startsWith('https://') ? `${c.label} (abre en nueva ventana)` : c.label} onClick={(event) => {
                if (c.label !== 'WhatsApp') return
                event.preventDefault()
                confirmWhatsAppShare(BRAND.whatsapp, 'Hola, solicito información sobre los paseos de PET Ap.')
              }}>
                {content}
              </a>
            ) : (
              <div key={i}>{content}</div>
            )
          })}

          {socials.length > 0 && (
            <div className="flex items-center gap-3 pt-4">
              {socials.map((s, i) => {
                const Icon = s.icon
                return (
                  <a
                    key={i}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${s.label} (abre en nueva ventana)`}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/5 text-muted transition-all hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Icon size={16} />
                  </a>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
