'use client'

import { motion } from 'framer-motion'
import { FaDog, FaMapMarkerAlt, FaWhatsapp, FaInstagram, FaFacebook } from 'react-icons/fa'

export default function Footer() {
  return (
    <footer className="relative border-t border-white/5 bg-dark/50">
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
            <p className="text-sm text-white/40 leading-relaxed">
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
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Horarios de paseos
            </h3>
            <div className="space-y-2 text-sm text-white/50">
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
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Contacto
            </h3>
            <div className="space-y-3 text-sm">
              <a
                href="https://wa.me/5215523053772"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-white/50 hover:text-green-400 transition-colors"
              >
                <FaWhatsapp size={14} />
                5523053772
              </a>
              <p className="flex items-center gap-2 text-white/50">
                <FaMapMarkerAlt size={14} className="text-primary" />
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
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
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
                  className={`w-10 h-10 rounded-full glass flex items-center justify-center text-white/50 ${color} transition-all duration-300 hover:scale-110`}
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
          className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <p className="text-xs text-white/30">
            © 2024 Paseos Quebrada. Todos los derechos reservados.
          </p>
          <p className="text-xs text-white/20 flex items-center gap-1">
            Hecho con <FaDog className="text-primary" size={10} /> para los
            perros de Cuautitlán
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
