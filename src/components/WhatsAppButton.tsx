'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaWhatsapp, FaTimes } from 'react-icons/fa'

export default function WhatsAppButton({ hidden }: { hidden?: boolean }) {
  const [show, setShow] = useState(false)
  const [tooltip, setTooltip] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {show && !hidden && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
          <AnimatePresence>
            {tooltip && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                className="glass-card !bg-dark-card/90 px-4 py-2 text-sm text-white whitespace-nowrap"
              >
                ¡Reserva su paseo por WhatsApp!
                <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-dark-card/90 transform rotate-45 border-r border-t border-white/5" />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.a
            href={`https://wa.me/5215523053772?text=¡Hola!%20Quiero%20agendar%20un%20paseo%20para%20mi%20perro%20🐾`}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onMouseEnter={() => setTooltip(true)}
            onMouseLeave={() => setTooltip(false)}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 
                       flex items-center justify-center shadow-lg shadow-green-500/30
                       hover:shadow-xl hover:shadow-green-500/40 transition-shadow
                       relative group"
          >
            <FaWhatsapp className="text-white text-2xl" />
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full border-2 border-green-400/40"
            />
          </motion.a>
        </div>
      )}
    </AnimatePresence>
  )
}
