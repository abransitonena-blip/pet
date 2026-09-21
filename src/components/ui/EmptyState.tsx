'use client'

import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import DogIllustration, { type DogPose } from './DogIllustration'

interface EmptyStateProps {
  icon?: ReactNode
  /**
   * Un perrito en lugar del ícono, haciendo algo que tenga que ver con lo que
   * falta. El ícono se conserva como respaldo: es lo que sale donde no se
   * eligió un dibujo.
   */
  illustration?: DogPose
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export default function EmptyState({ icon, illustration, title, description, action, className = '' }: EmptyStateProps) {
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
      {illustration ? (
        <DogIllustration pose={illustration} size={illustration === 'asomando' ? 104 : 120} className="mb-3" />
      ) : icon && (
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
