'use client'

import { useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { enablePush, pushAvailability } from '@/lib/push/pushClient'

/**
 * El ofrecimiento de activar los avisos, donde alguien lo entiende.
 *
 * El control para activarlos existía en tres pantallas -- Notificaciones de la
 * familia, el perfil del paseador y Configuración --, y a ninguna de las tres
 * entra nadie por su cuenta. El resultado era el mismo que no tenerlo: ningún
 * teléfono registrado y ningún aviso, sin que nada fallara.
 *
 * Esta franja sale en el inicio, que es la pantalla que todo el mundo abre, y
 * sólo cuando de verdad se puede activar: si el navegador ya los tiene
 * activados, si los bloqueó, o si no los admite, no hay nada que ofrecer y no
 * se dibuja. Quien dice "ahora no" no la vuelve a ver en este teléfono, y sigue
 * teniendo el control en su pantalla de siempre.
 */

const DISMISSED_KEY = 'pet-avisos-propuesta-descartada'

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export default function PushNudge({ message }: { message: string }) {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  useEffect(() => {
    setVisible(pushAvailability() === 'available' && !wasDismissed())
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISSED_KEY, '1') } catch { /* Sin almacenamiento, vuelve a salir. */ }
    setVisible(false)
  }

  const turnOn = async () => {
    setBusy(true)
    setFailure('')
    const result = await enablePush()
    setBusy(false)
    if (result.ok) { setVisible(false); return }
    // Cuando no se puede, se dice por qué y qué hacer, en vez de callar.
    setFailure(result.reason === 'blocked'
      ? 'El navegador tiene bloqueados los avisos. Actívalos en la configuración del sitio.'
      : result.reason === 'unsupported'
        ? 'Este navegador no admite avisos. En iPhone, primero agrega PET Ap a tu pantalla de inicio.'
        : 'No pudimos activarlos en este teléfono. Inténtalo otra vez.')
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
        <BellRing size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Avisos en este teléfono</p>
        <p className="mt-0.5 text-xs text-muted">{message}</p>
        {failure && <p role="status" className="mt-1 text-xs text-red-700">{failure}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => void turnOn()}
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {busy ? 'Activando…' : 'Activar'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ahora no"
          className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
