'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellRing, CheckCircle2, CircleAlert, Send } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { missingCount, type HealthCheck } from '@/lib/systemHealth'

/**
 * Qué está configurado y qué no, dicho en la pantalla.
 *
 * Lo que depende de una variable de entorno falla callado: ni error en la
 * consola, ni queja en el panel. Los avisos estuvieron muertos semanas porque
 * la llave estaba guardada con otro nombre. Aquí se lee cada dependencia --
 * avisos, identidad del servidor, fotos privadas, tareas programadas --, qué se
 * apaga mientras falte y cómo se arregla. Y hay una prueba real: un aviso a tu
 * propio teléfono.
 */

interface PushStatus {
  flagEnabled: boolean
  serverIdentity: boolean
  firestore: boolean
  people: number
  devices: number
  ownDevices: number
  checks: HealthCheck[]
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

export default function SystemHealthCard() {
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

  const dryRun = async (task: 'reminders' | 'guardia') => {
    setSending(true)
    setMessage('')
    try {
      const response = await authorizedFetch(`/api/cron/${task}?dryRun=1`, 'GET')
      const data = response ? await response.json().catch(() => ({})) as Record<string, unknown> : null
      if (!response || !response.ok) {
        setMessage(data?.code === 'privileged-identity-not-configured'
          ? 'El servidor no tiene la identidad para leer los paseos. Esto sólo funciona en producción.'
          : 'No pudimos hacer la prueba.')
      } else if (task === 'reminders') {
        // Los refuerzos de vacuna van en la misma tarea; si su lectura falló,
        // viene null y se dice, en vez de dar un cero que parece "nada que avisar".
        const vaccines = data?.vaccines as { reminders?: number; scanned?: number; capped?: boolean } | null | undefined
        const vaccineText = vaccines === null
          ? ' No pudimos revisar los refuerzos de vacuna.'
          : vaccines
            ? ` Hoy saldrían ${vaccines.reminders ?? 0} aviso(s) de refuerzo, de ${vaccines.scanned ?? 0} perro(s) revisados${vaccines.capped ? ' (hay más perros de los que se revisan)' : ''}.`
            : ''
        setMessage(`Mañana saldrían ${data?.reminders ?? 0} recordatorio(s), de ${data?.walks ?? 0} paseo(s) agendados para el ${data?.forDate}.${vaccineText}`)
      } else {
        setMessage(String(data?.message || 'Hoy no hay nada que reportar: ningún paseo sin paseador ni sin cerrar.'))
      }
    } catch {
      setMessage('No pudimos hacer la prueba.')
    }
    setSending(false)
  }

  const sendTest = async () => {
    setSending(true)
    setMessage('')
    try {
      const response = await authorizedFetch('/api/push/status', 'POST')
      const data = response ? await response.json().catch(() => ({})) as {
        code?: string
        sent?: number
        devices?: number
        failures?: Record<string, number>
      } : null
      if (!response || !response.ok) {
        setMessage(data?.code === 'privileged-identity-not-configured'
          ? 'El servidor no tiene la identidad para enviar avisos. Esto sólo funciona en producción.'
          : 'No pudimos mandar la prueba.')
      } else if ((data?.sent ?? 0) > 0) {
        setMessage(`Aviso enviado a ${data?.sent} dispositivo${data?.sent === 1 ? '' : 's'}. Revisa tu teléfono.`)
      } else if ((data?.devices ?? 0) === 0) {
        setMessage('No hay ningún teléfono tuyo registrado. Activa los avisos en este dispositivo y vuelve a probar.')
      } else {
        // Un cero sin explicación no se puede arreglar: aquí sale el motivo que
        // dio FCM, que es lo único que dice dónde se corta la cadena.
        const failures = data?.failures ?? {}
        const reason = failures['not-configured'] ? 'el servidor no tiene permiso para enviar por FCM'
          : failures['unregistered'] ? 'ese teléfono ya no acepta avisos (se desinstaló la app o se revocó el permiso)'
          : failures['send-failed'] ? 'FCM rechazó el envío'
          : 'no sabemos por qué'
        setMessage(`Tienes ${data?.devices} dispositivo(s) registrado(s), pero no salió ninguno: ${reason}.`)
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
  const checks = status.checks ?? []
  const missing = missingCount(checks)

  return (
    <Card className="p-4 shadow-none sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <BellRing size={17} className="text-primary" aria-hidden="true" />
        <h2 className="font-bold text-ink">Estado del sistema</h2>
      </div>
      <p className="mb-3 text-xs text-muted">
        {missing === 0
          ? 'Todo lo que la app necesita de fuera está en su lugar.'
          : `Faltan ${missing} pieza${missing === 1 ? '' : 's'}. Lo que falta no da error: simplemente no ocurre.`}
      </p>

      <ul className="space-y-3">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-sm">
            {check.state === 'ok'
              ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" />
              : <CircleAlert size={16} className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" />}
            <span className="min-w-0">
              <span className="text-ink">{check.label}</span>
              {check.detail && <span className="text-muted"> · {check.detail}</span>}
              <span className="sr-only">{check.state === 'ok' ? ': sí' : ': falta'}</span>
              {check.state === 'missing' && (
                <span className="mt-0.5 block text-xs text-muted">
                  {check.consequence}{check.fix ? ` ${check.fix}` : ''}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => void sendTest()} isLoading={sending} leftIcon={<Send size={14} />}>
          Enviarme un aviso de prueba
        </Button>
        {/* Ver qué saldría sin mandar nada: así no hay que esperar a la tarde
            para saber si los recordatorios funcionan. */}
        <Button size="sm" variant="secondary" onClick={() => void dryRun('reminders')} disabled={sending}>
          ¿Qué se recordaría mañana?
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void dryRun('guardia')} disabled={sending}>
          ¿Qué diría la guardia de hoy?
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
