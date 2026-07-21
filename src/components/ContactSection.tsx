'use client'

import { motion } from 'framer-motion'
import { useConfig } from '@/context/ConfigContext'
import { FaWhatsapp, FaClock, FaEnvelope, FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa'
import { formatBusinessHours } from '@/lib/defaultConfig'

export default function ContactSection() {
  const { config } = useConfig()

  const contacts = [
    { icon: FaWhatsapp, label: 'WhatsApp', value: config.whatsapp.replace(/521?/, ''), href: 'https://wa.me/' + config.whatsapp, color: 'text-green-400' },
    { icon: FaEnvelope, label: 'Correo electrónico', value: 'ap9871888@gmail.com', href: 'mailto:ap9871888@gmail.com', color: 'text-brand-400' },
    { icon: FaClock, label: formatBusinessHours().map((h) => h.weekday).join(' | '), value: formatBusinessHours().map((h) => h.hours).join(' | '), href: null, color: 'text-secondary' },
  ]

  const socials = [
    { icon: FaFacebook, label: 'Facebook', href: config.facebook || '#', color: 'hover:text-blue-500' },
    { icon: FaInstagram, label: 'Instagram', href: config.instagram || '#', color: 'hover:text-pink-500' },
    { icon: FaTiktok, label: 'TikTok', href: config.tiktok || '#', color: 'hover:text-white' },
  ]
  return (
    <section id="contacto" className="relative py-24 sm:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">
            Contáctanos
          </span>
          <h2 className="section-title mt-3">
            Estamos <span className="gradient-text">aquí</span>
          </h2>
          <p className="section-subtitle">
            Paseos caninos supervisados. Siempre listos para consentir a tu peludo.
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
              <div className="glass-card p-4 flex items-center gap-4 hover:bg-white/[0.03] transition-all">
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${c.color}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
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
                  className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 ${s.color} transition-all hover:bg-white/10`}
                >
                  <Icon size={16} />
                </a>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
