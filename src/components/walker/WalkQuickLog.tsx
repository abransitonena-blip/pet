'use client'

import { useState } from 'react'
import { Droplets, PawPrint, Smile, Timer } from 'lucide-react'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { persistWalkReport, useWalkReport } from '@/lib/useWalkReport'
import { applyWalkLog, type WalkLogEvent } from '@/lib/walkLog'
import { walkReportContentOf } from '@/lib/walkReports'

/**
 * Lo que pasa en el paseo, anotado sin salir de la tarjeta.
 *
 * Estos botones ya existían, pero dentro de la bitácora, a dos pantallas de
 * distancia: un paseador con la correa en una mano no navega hasta allá para
 * anotar que el perro hizo popó. Aquí quedan donde ocurre el paseo, y escriben
 * en el mismo borrador -- lo anotado aparece en la bitácora y llega a la familia
 * cuando el reporte se envía.
 *
 * El incidente no está aquí a propósito: necesita que alguien escriba qué pasó,
 * y eso no cabe en un botón.
 */

const BUTTONS: { event: Exclude<WalkLogEvent, 'incidente'>; label: string; icon: typeof PawPrint }[] = [
  { event: 'pipi', label: 'Pipí', icon: PawPrint },
  { event: 'popo', label: 'Popó', icon: PawPrint },
  { event: 'agua', label: 'Tomó agua', icon: Droplets },
  { event: 'juego', label: 'Jugó', icon: Smile },
  { event: 'descanso', label: 'Descanso', icon: Timer },
]

export default function WalkQuickLog({ sessionId }: { sessionId: string }) {
  const { report, state } = useWalkReport(sessionId, 'live')
  const [saving, setSaving] = useState<WalkLogEvent | ''>('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED || state === 'unavailable') return null
  if (report?.status === 'submitted') return null

  const log = async (event: WalkLogEvent, label: string) => {
    setSaving(event)
    setError('')
    setMessage('')
    const result = applyWalkLog(walkReportContentOf(report), event, new Date())
    if (!result.ok) {
      setError(result.reason === 'too-long'
        ? 'Esa parte de la bitácora llegó a su límite. Resúmela antes de anotar más.'
        : 'No pudimos anotarlo.')
      setSaving('')
      return
    }
    try {
      await persistWalkReport({ sessionId, content: result.content, mode: 'draft' })
      setMessage(`${label}, anotado.`)
    } catch {
      setError('No pudimos guardarlo. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving('')
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {BUTTONS.map(({ event, label, icon: Icon }) => (
          <button
            key={event}
            type="button"
            onClick={() => void log(event, label)}
            disabled={saving !== ''}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink/[0.04] px-3 text-sm font-medium text-ink transition-colors hover:bg-ink/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          >
            <Icon size={15} aria-hidden="true" />
            {saving === event ? 'Anotando…' : label}
          </button>
        ))}
      </div>
      {message && <p role="status" className="text-xs text-success-600">{message}</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
