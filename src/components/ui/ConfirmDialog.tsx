'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  icon?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  loading,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, loading, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/55 p-4 sm:items-center"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-sm rounded-xl border border-ink/10 bg-surface p-5 shadow-elevated sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  danger ? 'bg-danger-500/10' : 'bg-brand-500/10'
                }`}
              >
                {icon || <AlertTriangle size={18} style={{ color: danger ? 'var(--color-error)' : 'var(--color-primary)' }} />}
              </div>
              <div>
                <h3 id="confirm-dialog-title" className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {title}
                </h3>
                {description && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button ref={cancelRef} variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
                {cancelLabel}
              </Button>
              <Button
                variant={danger ? 'danger' : 'primary'}
                size="sm"
                onClick={onConfirm}
                isLoading={loading}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
