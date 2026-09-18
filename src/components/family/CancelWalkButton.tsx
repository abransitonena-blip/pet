'use client'

import { useState } from 'react'
import { CalendarX2 } from 'lucide-react'
import { Button, ConfirmDialog } from '@/components/ui'
import { cancelErrorMessage, cancelOwnWalk, canCancel, CANCEL_REASON_LIMIT } from '@/lib/familyCancellation'
import type { WalkSessionStatus } from '@/lib/domainStates'

/**
 * Cancelar un paseo desde el panel de familia.
 *
 * Pide confirmación porque no se deshace, y deja escribir el motivo sin
 * obligarlo: exigirlo sólo consigue motivos falsos. Lo que se escriba llega al
 * equipo tal cual, para que sepan si hay que ofrecer otra fecha.
 */
export default function CancelWalkButton({ sessionId, uid, status, dogName, onCancelled }: {
  sessionId: string
  uid: string
  status: WalkSessionStatus
  dogName?: string
  onCancelled?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  if (!canCancel(status)) return null

  const confirm = async () => {
    setWorking(true)
    setError('')
    const result = await cancelOwnWalk({ sessionId, uid, status, reason })
    setWorking(false)
    if (result.ok) {
      setOpen(false)
      setReason('')
      onCancelled?.()
      return
    }
    setError(cancelErrorMessage(result.reason))
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        leftIcon={<CalendarX2 size={14} />}
        className="text-muted hover:text-red-700"
      >
        Cancelar este paseo
      </Button>

      <ConfirmDialog
        open={open}
        title={dogName ? `¿Cancelar el paseo de ${dogName}?` : '¿Cancelar este paseo?'}
        description="El equipo se entera y el paseo deja de estar agendado. Si quieres otra fecha, puedes solicitar uno nuevo enseguida."
        confirmLabel="Sí, cancelar"
        cancelLabel="No, dejarlo"
        danger
        loading={working}
        onConfirm={() => void confirm()}
        onCancel={() => { if (!working) { setOpen(false); setError('') } }}
      >
        <div className="mt-3 text-left">
          <label htmlFor={`cancel-reason-${sessionId}`} className="text-xs font-medium text-muted">
            ¿Nos cuentas por qué? <span className="font-normal">(opcional)</span>
          </label>
          <textarea
            id={`cancel-reason-${sessionId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={CANCEL_REASON_LIMIT}
            rows={2}
            placeholder="Ej: nos salió un imprevisto"
            className="input-field mt-1 w-full resize-none text-sm"
          />
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      </ConfirmDialog>
    </>
  )
}
