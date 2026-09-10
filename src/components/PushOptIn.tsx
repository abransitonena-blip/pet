'use client'

import { useEffect, useState } from 'react'
import { BellOff, BellRing } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { disablePush, enablePush, pushAvailability, type PushAvailability } from '@/lib/push/pushClient'

/**
 * Avisos en este dispositivo.
 *
 * Renders nothing until push is switched on (FCM_ENABLED plus a VAPID key),
 * so there is never a dead control on screen in the meantime.
 */

const FAILURE_MESSAGES = {
  blocked: 'El navegador bloqueó los avisos. Actívalos desde la configuración del sitio y vuelve a intentarlo.',
  unsupported: 'Este navegador no admite avisos. En iPhone, primero agrega PET Ap a tu pantalla de inicio.',
  failed: 'No pudimos activar los avisos en este dispositivo. Inténtalo de nuevo.',
  off: 'Los avisos no están disponibles en este momento.',
} as const

export default function PushOptIn({ description }: { description: string }) {
  const [state, setState] = useState<PushAvailability>('off')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setState(pushAvailability())
  }, [])

  if (state === 'off') return null

  const turnOn = async () => {
    setBusy(true)
    setMessage('')
    const result = await enablePush()
    setBusy(false)
    setState(pushAvailability())
    if (!result.ok) setMessage(FAILURE_MESSAGES[result.reason])
  }

  const turnOff = async () => {
    setBusy(true)
    await disablePush()
    setBusy(false)
    setState(pushAvailability())
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-none">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          {state === 'enabled' ? <BellRing size={17} aria-hidden="true" /> : <BellOff size={17} aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Avisos en este dispositivo</p>
          <p className="mt-0.5 text-xs text-muted">
            {state === 'enabled'
              ? 'Activos. Puedes desactivarlos cuando quieras.'
              : state === 'blocked'
                ? FAILURE_MESSAGES.blocked
                : state === 'unsupported'
                  ? FAILURE_MESSAGES.unsupported
                  : description}
          </p>
          {message && <p role="status" className="mt-1 text-xs text-red-700">{message}</p>}
        </div>
      </div>
      {state === 'available' && (
        <Button size="sm" onClick={() => void turnOn()} isLoading={busy}>Activar avisos</Button>
      )}
      {state === 'enabled' && (
        <Button size="sm" variant="secondary" onClick={() => void turnOff()} isLoading={busy}>Desactivar</Button>
      )}
    </Card>
  )
}
