'use client'

import { motion } from 'framer-motion'
import { useConfig } from '@/context/ConfigContext'
import { FaWhatsapp, FaMapMarkerAlt, FaClock, FaPhone, FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa'
import { formatBusinessHours } from '@/lib/defaultConfig'

export default function ContactSection() {
  const { config } = useConfig()

  const contacts = [
    { icon: FaWhatsapp, label: 'WhatsApp', value: config.whatsapp, href: 'https://wa.me/52' + config.whatsapp, color: 'text-green-400' },
    { icon: FaPhone, label: 'Teléfono', value: config.whatsapp, href: 'tel:' + config.whatsapp, color: 'text-primary' },
    { icon: FaMapMarkerAlt, label: 'Zona Quebrada, Cuautitlán', value: 'Estado de México', href: 'https://maps.app.goo.gl/oS5fBwZdyTYAk7U3A', color: 'text-red-400' },
    { icon: FaClock, label: formatBusinessHours().map((h) => h.weekday).join(' | '), value: formatBusinessHours().map((h) => h.hours).join(' | '), href: null, color: 'text-secondary' },
  ]

  const socials = [
    { icon: FaFacebook, label: 'Facebook', href: config.facebook || '#', color: 'hover:text-blue-500' },
    { icon: FaInstagram, label: 'Instagram', href: config.instagram || '#', color: 'hover:text-pink-500' },
    { icon: FaTiktok, label: 'TikTok', href: config.tiktok || '#', color: 'hover:text-white' },
  ]
  return (
    <section id="contacto" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">
            Contáctanos
          </span>
          <h2 className="section-title mt-3">
            Estamos <span className="gradient-text">aquí</span>
          </h2>
          <p className="section-subtitle">
            Paseos caninos en Zona Quebrada, Cuautitlán. Siempre listos para consentir a tu peludo.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            {contacts.map((c, i) => {
              const Icon = c.icon
              const content = (
                <div className="glass-card p-4 flex items-center gap-4 hover:bg-white/[0.03] transition-all">
                  <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${c.color}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm text-white/40">{c.label}</p>
                    <p className="text-sm font-medium text-white">{c.value}</p>
                  </div>
                </div>
              )
              return c.href ? (
                <a key={i} href={c.href} target="_blank" rel="noopener noreferrer" aria-label={`${c.label} (abre en nueva ventana)`}>
                  {content}
                </a>
              ) : (
                <div key={i}>{content}</div>
              )
            })}

            <div className="flex items-center gap-3 pt-2">
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

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-card overflow-hidden rounded-2xl"
          >
            <iframe
              title="Zona Quebrada, Cuautitlán"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-99.1300%2C19.6800%2C-99.0900%2C19.7000&amp;layer=mapnik&amp;marker=19.6900%2C-99.1100"
              width="100%"
              height="350"
              style={{ border: 0, filter: 'invert(0.9) hue-rotate(180deg)' }}
              allowFullScreen
              loading="lazy"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
