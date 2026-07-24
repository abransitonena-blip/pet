'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaDog, FaExclamationTriangle } from 'react-icons/fa'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-center max-w-sm"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-16 h-16 rounded-2xl bg-danger-500/10 flex items-center justify-center mx-auto mb-4"
        >
          <FaExclamationTriangle size={24} className="text-danger-400" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl font-bold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Algo salió mal
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-sm mb-6"
          style={{ color: 'var(--text-muted)' }}
        >
          Ocurrió un error inesperado. Por favor intenta de nuevo.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-3 justify-center"
        >
          <button onClick={reset} className="btn-primary text-sm">
            Intentar de nuevo
          </button>
          <a href="/" className="btn-secondary text-sm">
            Volver al inicio
          </a>
        </motion.div>
      </motion.div>
    </div>
  )
}
