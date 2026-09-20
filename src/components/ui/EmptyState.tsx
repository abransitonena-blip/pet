'use client'

import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      className={`text-center py-10 ${className}`}
      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {/* El cuadro del ícono era gris sobre gris y se leía como una falla.
          Con el tinte de la casa, un hueco vacío se ve como un lugar que
          todavía no se llena, que es lo que es. */}
      {icon && (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <span className="text-xl">{icon}</span>
        </div>
      )}
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {description && (
        <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  )
}
