'use client'

import { AlertTriangle } from 'lucide-react'

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
  return (
    <div className="text-center py-10" role="alert">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-danger-500/10">
        <AlertTriangle size={22} style={{ color: 'var(--color-error)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-danger-500/10 transition-colors hover:bg-danger-500/20"
          style={{ color: 'var(--color-error)' }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
