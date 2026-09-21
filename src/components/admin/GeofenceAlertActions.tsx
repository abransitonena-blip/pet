'use client'

import { useState } from 'react'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { BellRing, Check } from 'lucide-react'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import BottomSheet from '@/components/ui/BottomSheet'
import { FAMILY_NOTICE_LIMIT, checkFamilyNotice, defaultFamilyNotice, familyNoticeMessage } from '@/lib/familyNotice'

/**
 * Qué hace administración con una salida del área recomendada.
 *
 * Hay dos caminos, y el orden importa:
 * - "Todo en orden": la revisó y no pasa nada. La familia no se entera.
 * - "Avisar a la familia": hubo un percance, o lo parece. Abre el texto que se le
 *   va a mandar, editable, y sólo entonces sale.
 *
 * La familia nunca se entera sola. Una lectura de GPS fuera del área puede ser un
 * árbol, una vuelta más larga por el parque o un percance de verdad, y sólo
 * quien opera puede distinguirlos; por eso la salida se alerta primero a
 * administración y sólo después, si ella lo decide, a la familia.
 */

interface Props {
  alertId: string
  walkerName: string
  /** Ya se le avisó a la familia por esta alerta: no se ofrece de nuevo. */
  familyNotified?: boolean
  /** Ya está marcada como vista: sólo queda, si acaso, avisar a la familia. */
  acknowledged?: boolean
  size?: 'sm' | 'xs'
}

const ERRORS: Record<string, string> = {
  'already-notified': 'A esta familia ya se le avisó por esta alerta.',
  'no-family': 'Esta alerta no tiene una familia a la cual avisar.',
  'alert-not-found': 'La alerta ya no existe.',
  'invalid-message': 'El texto no es válido.',
  'delivery-failed': 'No se pudo entregar el aviso. Vuelve a intentarlo.',
  'rate-limited': 'Demasiados intentos. Espera unos minutos.',
  forbidden: 'Tu sesión no puede avisar a las familias.',
}

export default function GeofenceAlertActions({ alertId, walkerName, familyNotified = false, acknowledged = false, size = 'sm' }: Props) {
  const [working, setWorking] = useState(false)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  const button = `inline-flex ${size === 'xs' ? 'min-h-9 text-xs' : 'min-h-11 text-sm'} items-center gap-1.5 rounded-full px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50`

  const allRight = async () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    setWorking(true)
    try {
      await updateDoc(doc(db, 'geofenceAlerts', alertId), { status: 'acknowledged', acknowledgedBy: uid, acknowledgedAt: serverTimestamp() })
    } catch {
      // La alerta sigue a la vista; se puede intentar de nuevo.
    } finally {
      setWorking(false)
    }
  }

  const openNotice = () => {
    setText(defaultFamilyNotice({ walkerName }))
    setError('')
    setOpen(true)
  }

  const send = async () => {
    const check = checkFamilyNotice(text)
    if (check !== 'ok') { setError(familyNoticeMessage(check)); return }
    setWorking(true)
    setError('')
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) { setError('Tu sesión venció. Vuelve a entrar.'); return }
      const response = await fetch('/api/geofence/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId: alertId, message: text.trim() }),
      })
      const data = await response.json().catch(() => ({})) as { code?: string; phoneReached?: boolean }
      if (!response.ok) { setError(ERRORS[data.code ?? ''] ?? 'No pudimos avisar a la familia. Inténtalo de nuevo.'); return }
      setOpen(false)
      // Se dice hasta dónde llegó: sin avisos activos en su teléfono, sólo lo verá en su panel.
      setResult(data.phoneReached
        ? 'Aviso enviado al teléfono y al panel de la familia.'
        : 'Aviso guardado en el panel de la familia. No tiene avisos activos en su teléfono, así que no le sonó: conviene escribirle por WhatsApp.')
    } catch {
      setError('No pudimos avisar a la familia. Revisa tu conexión.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {!acknowledged && (
          <button
            type="button"
            onClick={() => void allRight()}
            disabled={working}
            className={`${button} bg-surface text-red-800 hover:bg-ink/5`}
          >
            <Check size={14} aria-hidden="true" /> Todo en orden
          </button>
        )}
        {!familyNotified && !result && (
          <button
            type="button"
            onClick={openNotice}
            disabled={working}
            className={`${button} bg-red-800 text-white hover:bg-red-900`}
          >
            <BellRing size={14} aria-hidden="true" /> Avisar a la familia
          </button>
        )}
      </div>
      {(familyNotified || result) && (
        <p role="status" className="max-w-xs text-right text-xs text-muted">{result || 'Ya se le avisó a la familia.'}</p>
      )}

      <BottomSheet open={open} onClose={() => { if (!working) setOpen(false) }} title="Avisar a la familia">
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Esto le llega a la familia en su panel y en su teléfono, con tu texto. Puedes cambiarlo antes de enviarlo.
            Sólo se le avisa una vez por alerta.
          </p>
          <label htmlFor="family-notice" className="block text-xs font-semibold text-ink">Lo que verá la familia</label>
          <textarea
            id="family-notice"
            value={text}
            onChange={(event) => { setText(event.target.value); setError('') }}
            maxLength={FAMILY_NOTICE_LIMIT + 40}
            rows={5}
            className="input-field w-full resize-none"
          />
          <p className="text-right text-2xs text-muted" aria-live="polite">{text.trim().length} / {FAMILY_NOTICE_LIMIT}</p>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={working} className={`${button} text-muted hover:bg-ink/5`}>Cancelar</button>
            <button type="button" onClick={() => void send()} disabled={working} className={`${button} bg-primary text-white`}>
              {working ? 'Enviando…' : 'Enviar a la familia'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
