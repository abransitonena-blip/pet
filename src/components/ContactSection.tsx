'use client'

import { motion } from 'framer-motion'
import { useConfig } from '@/context/ConfigContext'
import { MessageCircle, Mail, Clock, Music } from 'lucide-react'
import { FacebookIcon, InstagramIcon } from '@/components/ui/SocialIcons'
import { formatBusinessHours } from '@/lib/defaultConfig'
import { BRAND } from '@/lib/brand'

export default function ContactSection() {
  const { config } = useConfig()

  const contacts = [
    { icon: MessageCircle, label: 'WhatsApp', value: `+52 ${config.whatsapp.slice(3, 5)} ${config.whatsapp.slice(5, 9)} ${config.whatsapp.slice(9)}`, href: 'https://wa.me/' + config.whatsapp },
    { icon: Mail, label: 'Correo electrónico', value: BRAND.email, href: `mailto:${BRAND.email}` },
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
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="text-primary text-sm uppercase tracking-widest font-medium">Contáctanos</span>
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
                  <p className="text-sm font-medium text-ink truncate">{c.value}</p>
                </div>
              </div>
            )
            return c.href ? (
              <a key={i} href={c.href} target={c.href.startsWith('mailto') ? undefined : '_blank'} rel="noopener noreferrer" aria-label={`${c.label} (abre en nueva ventana)`}>
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
                    className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-muted hover:text-primary hover:bg-primary/10 transition-all"
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
