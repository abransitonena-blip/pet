'use client'

import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'
import { reportError } from '@/lib/reportError'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    console.error('Application error:', error)
    reportError(error, 'app/error-boundary')
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <motion.div
        role="alert"
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="max-w-sm text-center"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10">
          <AlertTriangle size={24} className="text-danger" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-ink">Algo salió mal</h1>
        <p className="mb-6 text-sm text-muted">Ocurrió un error inesperado. Ya quedó registrado; intenta de nuevo.</p>
        <div className="flex justify-center gap-3">
          <Button onClick={reset}>Intentar de nuevo</Button>
          <Button variant="secondary" onClick={() => { window.location.href = '/' }}>Volver al inicio</Button>
        </div>
      </motion.div>
    </div>
  )
}
