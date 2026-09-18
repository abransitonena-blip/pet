'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellRing, CheckCircle2, CircleAlert, Send } from 'lucide-react'
import { Button, Card } from '@/components/ui'

/**
 * Si los avisos llegan o no, dicho en la pantalla.
 *
 * Un aviso que no llega no deja rastro: ni error en la consola, ni queja en el
 * panel. Estuvieron apagados semanas porque la llave del navegador estaba
 * guardada con otro nombre, y no había dónde verlo. Esta tarjeta enseña las
 * cuatro piezas y ofrece una prueba real: un aviso a tu propio teléfono.
 */

interface PushStatus {
  flagEnabled: boolean
  serverIdentity: boolean
  firestore: boolean
  people: number
  devices: number
  ownDevices: number
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; status: PushStatus }
  | { kind: 'denied' }
  | { kind: 'error' }

async function authorizedFetch(path: string, method: 'GET' | 'POST') {
  const { auth } = await import('@/firebase/config')
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) return null
  return fetch(path, { method, headers: { Authorization: `Bearer ${idToken}` } })
}

export default function PushHealthCard() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await authorizedFetch('/api/push/status', 'GET')
      if (!response) return setState({ kind: 'error' })
      if (response.status === 403) return setState({ kind: 'denied' })
      if (!response.ok) return setState({ kind: 'error' })
      setState({ kind: 'ready', status: await response.json() as PushStatus })
    } catch {
      setState({ kind: 'error' })
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const sendTest = async () => {
    setSending(true)
    setMessage('')
    try {
      const response = await authorizedFetch('/api/push/status', 'POST')
      const data = response ? await response.json().catch(() => ({})) as { code?: string; sent?: number } : null
      if (!response || !response.ok) {
        setMessage(data?.code === 'privileged-identity-not-configured'
          ? 'El servidor no tiene la identidad para enviar avisos. Esto sólo funciona en producción.'
          : 'No pudimos mandar la prueba.')
      } else if ((data?.sent ?? 0) === 0) {
        setMessage('No hay ningún teléfono tuyo registrado. Activa los avisos en este dispositivo y vuelve a probar.')
      } else {
        setMessage(`Aviso enviado a ${data?.sent} dispositivo${data?.sent === 1 ? '' : 's'}. Revisa tu teléfono.`)
      }
    } catch {
      setMessage('No pudimos mandar la prueba.')
    }
    setSending(false)
    void load()
  }

  if (state.kind === 'denied' || state.kind === 'error') return null
  if (state.kind === 'loading') {
    return <Card className="p-4 shadow-none"><div className="skeleton h-20 rounded-xl" /></Card>
  }

  const { status } = state
  const checks = [
    { label: 'Función encendida en el código', ok: status.flagEnabled },
    { label: 'El servidor puede enviar (identidad privilegiada)', ok: status.serverIdentity },
    { label: 'Hay teléfonos registrados', ok: status.devices > 0, detail: `${status.devices} en ${status.people} cuenta${status.people === 1 ? '' : 's'}` },
  ]
  const allOk = checks.every((check) => check.ok)

  return (
    <Card className="p-4 shadow-none sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <BellRing size={17} className="text-primary" aria-hidden="true" />
        <h2 className="font-bold text-ink">Avisos al teléfono</h2>
      </div>
      <p className="mb-3 text-xs text-muted">
        {allOk
          ? 'Todo lo necesario está en su lugar. La prueba lo confirma de punta a punta.'
          : 'Falta algo para que un aviso llegue. Mientras falte, nadie recibe nada y no aparece ningún error.'}
      </p>

      <ul className="space-y-2">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start gap-2 text-sm">
            {check.ok
              ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" />
              : <CircleAlert size={16} className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" />}
            <span className="text-ink">
              {check.label}
              {check.detail && <span className="text-muted"> · {check.detail}</span>}
              <span className="sr-only">{check.ok ? ': sí' : ': falta'}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => void sendTest()} isLoading={sending} leftIcon={<Send size={14} />}>
          Enviarme un aviso de prueba
        </Button>
        <span className="text-xs text-muted">
          {status.ownDevices > 0
            ? `Tienes ${status.ownDevices} dispositivo${status.ownDevices === 1 ? '' : 's'} registrado${status.ownDevices === 1 ? '' : 's'}.`
            : 'Todavía no registras este dispositivo.'}
        </span>
      </div>
      {message && <p role="status" className="mt-2 text-sm text-ink">{message}</p>}
    </Card>
  )
}
