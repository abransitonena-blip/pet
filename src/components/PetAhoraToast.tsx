'use client'

import { useState, createContext, useContext, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaBolt, FaDog } from 'react-icons/fa'
import { playOfferChime } from '@/lib/notificationSound'

interface Toast {
  id: string
  petName: string
  petType: string
  offerId: string
  requestId: string
  onClick: () => void
}

interface ToastCtx {
  showOfferToast: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastCtx>({ showOfferToast: () => {} })

export function usePetAhoraToast() {
  return useContext(ToastContext)
}

export function PetAhoraToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showOfferToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `${t.offerId}-${Date.now()}`
    setToasts((prev) => [...prev, { ...t, id }])
    playOfferChime()
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 8000)
  }, [])

  return (
    <ToastContext.Provider value={{ showOfferToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              onClick={() => {
                t.onClick()
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }}
              className="w-full p-3 rounded-xl text-left shadow-lg flex items-center gap-3 border"
              style={{ background: 'var(--bg-card)', borderColor: 'rgba(251,191,36,0.3)' }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(251,191,36,0.15)' }}>
                <FaBolt className="text-secondary" size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nueva solicitud PET Ahora</p>
                <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <FaDog size={9} /> {t.petName}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: 'rgba(251,191,36,0.1)', color: 'var(--color-primary)' }}>
                Ver
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
