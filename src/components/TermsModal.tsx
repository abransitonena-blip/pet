'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Dog } from 'lucide-react'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { termsSections, TERMS_LAST_UPDATED } from '@/lib/termsContent'

export default function TermsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEscapeKey(onClose, isOpen)
  const trapRef = useFocusTrap(isOpen)
  const sections = termsSections
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[var(--z-overlay)] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 sm:p-8"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white">
                  <Dog />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Términos y condiciones</h2>
                  <p className="text-xs text-white/40">PET Ap</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/40 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.08 } },
              }}
              className="space-y-5"
            >
              {sections.map((section, i) => {
                const Icon = section.icon
                return (
                  <motion.div
                    key={i}
                    variants={{
                      hidden: { opacity: 0, y: 15 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    className="glass p-4 rounded-xl"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="text-primary" size={14} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-white mb-1.5">{section.title}</h3>
                        <p className="text-sm text-white/60 leading-relaxed">{section.content}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <p className="text-2xs text-white/30">Última actualización: {TERMS_LAST_UPDATED}</p>
              <button
                onClick={onClose}
                className="text-xs px-4 py-2 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-all"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
