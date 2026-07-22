'use client'

import { useEffect } from 'react'
import { FaDog, FaExclamationTriangle } from 'react-icons/fa'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-danger-500/10 flex items-center justify-center mx-auto mb-4">
          <FaExclamationTriangle size={24} className="text-danger-400" />
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Algo salió mal</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Ocurrió un error inesperado. Por favor intenta de nuevo.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary text-sm">
            Intentar de nuevo
          </button>
          <a href="/" className="btn-secondary text-sm">
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
