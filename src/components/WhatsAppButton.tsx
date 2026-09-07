'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { brand } from '@/lib/brand'
import { Events } from '@/lib/analytics'

export default function WhatsAppButton({ hidden }: { hidden?: boolean }) {
  const [show, setShow] = useState(false)
  const [tooltip, setTooltip] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const message = 'Hola, quiero información para solicitar un paseo PET.'

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {show && !hidden && (
        <div className="fixed bottom-6 right-6 z-[var(--z-sticky)] flex items-center gap-3">
          <AnimatePresence>
            {tooltip && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                className="glass-card !bg-ink/90 px-4 py-2 text-sm text-white whitespace-nowrap"
              >
                ¡Reserva su paseo por WhatsApp!
                <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-ink/90 transform rotate-45 border-r border-t border-white/5" />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            aria-label="Contactar por WhatsApp para reservar paseo"
            onClick={() => setReviewOpen(true)}
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
            <WhatsAppIcon className="text-white text-2xl" />
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.32, repeat: Infinity }}
              className="absolute inset-0 rounded-full border-2 border-green-400/40"
            />
          </motion.button>
          {reviewOpen && (
            <div role="dialog" aria-modal="false" aria-label="Revisar mensaje de WhatsApp" className="absolute bottom-16 right-0 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border p-4 shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <p className="text-sm font-semibold text-ink">Antes de abrir WhatsApp</p>
              <p className="mt-1 text-xs text-muted">Se compartirá con Meta el número de PET Ap y este mensaje:</p>
              <p className="mt-3 rounded-lg p-3 text-xs text-ink" style={{ background: 'var(--glass-bg)' }}>{message}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-secondary min-h-11 text-xs" onClick={() => setReviewOpen(false)}>Cancelar</button>
                <a className="btn btn-secondary min-h-11 text-xs inline-flex items-center justify-center" href={`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" onClick={() => { Events.whatsappClick('flotante'); setReviewOpen(false) }}>Continuar</a>
              </div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  )
}

import { WhatsAppIcon } from '@/components/ui/SocialIcons'
