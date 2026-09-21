'use client'

import { useEffect, useState } from 'react'
import { BellRing, Share, SquarePlus, X } from 'lucide-react'
import { enablePush, pushAvailability } from '@/lib/push/pushClient'
import { installAdvice, readDevice, type InstallAdvice } from '@/lib/installGuide'

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
const INSTALL_DISMISSED_KEY = 'pet-avisos-instalar-descartada'

function wasDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/**
 * En iPhone, una pestaña de Safari no puede recibir avisos: sólo la app
 * agregada a la pantalla de inicio. Ahí el botón de activar ni siquiera
 * existe, así que aquí se enseña el camino en lugar de callar.
 */
function InstallSteps({ advice, onDismiss }: { advice: Exclude<InstallAdvice, 'none'>; onDismiss: () => void }) {
  return (
    <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
          <BellRing size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Para recibir avisos en tu iPhone</p>
          <p className="mt-0.5 text-xs text-muted">
            {advice === 'open-in-safari'
              ? 'Ábrela en Safari y agrégala a tu pantalla de inicio. Este navegador no puede hacerlo.'
              : 'En iPhone los avisos sólo llegan si PET Ap está en tu pantalla de inicio. Son tres toques:'}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Ahora no"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {advice === 'add-to-home' && (
        <ol className="space-y-2 text-sm text-ink">
          <li className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-2xs font-bold text-white">1</span>
            <span>Toca <Share size={15} className="mx-0.5 inline align-text-bottom text-primary" aria-hidden="true" /> <strong>Compartir</strong>, el cuadro con una flecha hacia arriba de Safari.</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-2xs font-bold text-white">2</span>
            <span>Elige <SquarePlus size={15} className="mx-0.5 inline align-text-bottom text-primary" aria-hidden="true" /> <strong>Agregar a pantalla de inicio</strong>.</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-2xs font-bold text-white">3</span>
            <span>Abre <strong>PET Ap desde el ícono nuevo</strong>, no desde Safari, y activa los avisos ahí.</span>
          </li>
        </ol>
      )}
      <p className="text-xs text-muted">Necesitas iOS 16.4 o más reciente.</p>
    </div>
  )
}

export default function PushNudge({ message }: { message: string }) {
  const [visible, setVisible] = useState(false)
  const [install, setInstall] = useState<InstallAdvice>('none')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  useEffect(() => {
    const availability = pushAvailability()
    // Con la función apagada o los avisos ya activos no hay nada que ofrecer.
    if (availability === 'off' || availability === 'enabled') return
    const device = readDevice()
    const advice = device ? installAdvice(device) : 'none'
    if (advice !== 'none') {
      // En una pestaña de iPhone los avisos no existen, sea lo que sea que
      // diga el navegador: primero hay que instalarla.
      if (!wasDismissed(INSTALL_DISMISSED_KEY)) setInstall(advice)
      return
    }
    setVisible(availability === 'available' && !wasDismissed(DISMISSED_KEY))
  }, [])

  const remember = (key: string) => {
    try { window.localStorage.setItem(key, '1') } catch { /* Sin almacenamiento, vuelve a salir. */ }
  }

  if (install !== 'none') {
    return (
      <InstallSteps
        advice={install}
        onDismiss={() => { remember(INSTALL_DISMISSED_KEY); setInstall('none') }}
      />
    )
  }

  if (!visible) return null

  const dismiss = () => {
    remember(DISMISSED_KEY)
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
