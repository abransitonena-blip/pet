'use client'

import { motion, useReducedMotion } from 'framer-motion'

interface LoadingStateProps {
  message?: string
  rows?: number
  height?: string
}

export default function LoadingState({ message = 'Cargando...', rows = 3, height = 'h-14' }: LoadingStateProps) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      aria-busy="true"
      role="status"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`skeleton ${height} rounded-xl`} />
        ))}
      </div>
      <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>{message}</p>
      <span className="sr-only">{message}</span>
    </motion.div>
  )
}
