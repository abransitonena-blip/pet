'use client'

import { AlertTriangle } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import Button from '@/components/ui/Button'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
}

export default function ErrorState({
  title = 'No se pudo cargar la información',
  description = 'Ocurrió un error inesperado. Inténtalo de nuevo.',
  onRetry,
  retryLabel = 'Reintentar',
}: ErrorStateProps) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      className="text-center py-10"
      role="alert"
      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-danger-500/10">
        <AlertTriangle size={22} style={{ color: 'var(--color-error)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>{description}</p>
      {onRetry && (
        <Button
          variant="secondary"
          onClick={onRetry}
          className="mt-4 border-danger/30 text-danger hover:bg-danger-light"
        >
          {retryLabel}
        </Button>
      )}
    </motion.div>
  )
}
