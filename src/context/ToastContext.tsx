'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  toast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[var(--z-toast)] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium backdrop-blur-md border"
              style={{
                background: t.type === 'success' ? 'rgba(5,150,105,0.15)' : t.type === 'error' ? 'rgba(220,38,38,0.15)' : 'rgba(59,130,246,0.15)',
                borderColor: t.type === 'success' ? 'rgba(5,150,105,0.3)' : t.type === 'error' ? 'rgba(220,38,38,0.3)' : 'rgba(59,130,246,0.3)',
                color: t.type === 'success' ? 'var(--color-success)' : t.type === 'error' ? 'var(--color-danger)' : 'var(--color-info)',
              }}
              onClick={() => dismiss(t.id)}
            >
              {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✕ ' : 'ℹ '}{t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
