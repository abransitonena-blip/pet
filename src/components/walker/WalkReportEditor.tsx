'use client'

import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { AlertTriangle, Camera, Droplets, PawPrint, Smile, Timer } from 'lucide-react'
import { db } from '@/firebase/config'
import { Button, Card, ErrorState, LoadingState } from '@/components/ui'
import WalkPhotos from '@/components/walker/WalkPhotos'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { persistWalkReport, useWalkReport } from '@/lib/useWalkReport'
import { uploadWalkPhoto, walkPhotoErrorMessage } from '@/lib/media/walkPhotoUpload'
import { applyWalkLog, type WalkLogEvent } from '@/lib/walkLog'
import {
  EMPTY_WALK_REPORT,
  MAX_WALK_PHOTOS,
  WALK_REPORT_TEXT_LIMITS,
  validateWalkReportContent,
  walkReportContentOf,
  type WalkReportContent,
  type WalkReportValidationError,
} from '@/lib/walkReports'

/**
 * Bitácora y reporte del paseo.
 *
 * The same draft serves both moments: during the walk the walker logs events
 * and photos as they happen (the rules already accept a draft before the walk
 * is completed), and afterwards writes the summary and submits. The family
 * sees nothing -- text or photos -- until the report is submitted.
 */

const LOG_BUTTONS: { event: Exclude<WalkLogEvent, 'incidente'>; label: string; icon: typeof PawPrint }[] = [
  { event: 'pipi', label: 'Pipí', icon: PawPrint },
  { event: 'popo', label: 'Popó', icon: PawPrint },
  { event: 'agua', label: 'Tomó agua', icon: Droplets },
  { event: 'juego', label: 'Jugó', icon: Smile },
  { event: 'descanso', label: 'Descanso', icon: Timer },
]

const WALK_UNDERWAY = new Set(['on_the_way', 'arrived', 'in_progress'])

const LABELS = { summary: 'Resumen', behaviorNotes: 'Comportamiento', bathroomNotes: 'Baño y necesidades', incidentsSummary: 'Incidencias' }

function validationMessage(error: WalkReportValidationError): string {
  if (error === 'summary-required') return 'Escribe un resumen antes de enviar.'
  if (error === 'too-many-photos') return `Máximo ${MAX_WALK_PHOTOS} fotos por paseo.`
  if (error === 'media-invalid' || error === 'media-disabled') return 'Una de las fotos no es válida. Quítala e inténtalo de nuevo.'
  return 'Revisa los límites de texto del reporte.'
}

function saveErrorMessage(code: string): string {
  if (code === 'walk-session-not-completed') return 'Podrás enviar el reporte cuando el paseo esté completado.'
  if (code === 'walk-report-already-submitted') return 'Este reporte ya fue enviado y no admite cambios.'
  if (code === 'walk-session-not-found') return 'La sesión ya no está disponible.'
  if (code.includes('permission-denied')) return 'Ya no tienes permiso. Verifica que la sesión siga asignada a tu cuenta y que tu perfil esté activo.'
  return 'No pudimos guardar. Revisa tu conexión e inténtalo nuevamente.'
}

export default function WalkReportEditor({ sessionId }: { sessionId: string }) {
  const { report, state } = useWalkReport(sessionId, 'live')
  const [content, setContent] = useState<WalkReportContent>(EMPTY_WALK_REPORT)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [incident, setIncident] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const operationInFlight = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!report) return
    setContent(walkReportContentOf(report))
  }, [report])

  useEffect(() => {
    return onSnapshot(
      doc(db, 'walkSessions', sessionId),
      (snapshot) => setSessionStatus(snapshot.exists() ? String(snapshot.data().status ?? '') : null),
      () => setSessionStatus(null),
    )
  }, [sessionId])

  if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED || state === 'unavailable') {
    return <Card className="p-5 shadow-none"><p className="font-semibold text-ink">Reportes en preparación</p><p className="mt-1 text-sm text-muted">La captura se habilitará cuando las reglas canónicas sean publicadas.</p></Card>
  }
  if (state === 'loading') return <LoadingState message="Cargando reporte…" rows={3} />
  if (state === 'permission-denied' || state === 'network-error') {
    return <ErrorState description={state === 'permission-denied' ? 'No tienes permiso para consultar este reporte.' : 'No pudimos consultar el reporte. Revisa tu conexión.'} />
  }
  if (report?.status === 'submitted') return <ReportReadOnly report={report} sessionId={sessionId} />

  const underway = sessionStatus !== null && WALK_UNDERWAY.has(sessionStatus)
  const canSubmit = sessionStatus === 'completed'

  const persist = async (next: WalkReportContent, mode: 'draft' | 'submit', success: string): Promise<boolean> => {
    if (operationInFlight.current) return false
    const errors = validateWalkReportContent(next, mode)
    if (errors.length > 0) {
      setError(validationMessage(errors[0]))
      return false
    }
    operationInFlight.current = true
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await persistWalkReport({ sessionId, content: next, mode })
      setMessage(success)
      return true
    } catch (cause) {
      setError(saveErrorMessage(cause instanceof Error ? cause.message : ''))
      return false
    } finally {
      operationInFlight.current = false
      setSaving(false)
    }
  }

  const setField = <K extends keyof WalkReportContent>(key: K, value: WalkReportContent[K]) => setContent((current) => ({ ...current, [key]: value }))

  const logEvent = async (event: WalkLogEvent, detail = '') => {
    const result = applyWalkLog(content, event, new Date(), detail)
    if (!result.ok) {
      setError(result.reason === 'detail-required'
        ? 'Describe brevemente el incidente antes de registrarlo.'
        : 'Ese apartado llegó a su límite de texto. Resume las notas antes de agregar más.')
      return
    }
    setContent(result.content)
    const saved = await persist(result.content, 'draft', 'Registrado en la bitácora.')
    if (saved && event === 'incidente') setIncident('')
  }

  const addPhoto = async (file: File) => {
    if (content.mediaReferences.length >= MAX_WALK_PHOTOS) {
      setError(`Máximo ${MAX_WALK_PHOTOS} fotos por paseo.`)
      return
    }
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const reference = await uploadWalkPhoto(sessionId, file)
      const next = { ...content, mediaReferences: [...content.mediaReferences, reference] }
      setContent(next)
      await persist(next, 'draft', 'Foto agregada al reporte.')
    } catch (cause) {
      setError(walkPhotoErrorMessage(cause instanceof Error ? cause.message : ''))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const removePhoto = async (reference: string) => {
    const next = { ...content, mediaReferences: content.mediaReferences.filter((item) => item !== reference) }
    setContent(next)
    await persist(next, 'draft', 'Foto quitada del reporte.')
  }

  const submit = async () => {
    if (!canSubmit) {
      setError('Podrás enviar el reporte cuando el paseo esté completado.')
      return
    }
    if (!window.confirm('¿Enviar este reporte? Después no podrás modificarlo.')) return
    await persist(content, 'submit', 'Reporte enviado.')
  }

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void submit() }}>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{underway ? 'Bitácora en curso' : 'Reporte del paseo'}</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{underway ? 'Registra lo que pasa en el paseo' : 'Documenta lo importante'}</h1>
        <p className="mt-1 text-sm text-muted">El borrador es privado. La familia lo verá, con sus fotos, cuando lo envíes al terminar el paseo.</p>
      </header>

      <section aria-labelledby="walk-log-title" className="space-y-3">
        <h2 id="walk-log-title" className="text-sm font-semibold text-ink">Registro rápido</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {LOG_BUTTONS.map(({ event, label, icon: Icon }) => (
            <button
              key={event}
              type="button"
              disabled={saving}
              onClick={() => void logEvent(event)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary/10 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={incident}
            onChange={(event) => setIncident(event.target.value)}
            maxLength={200}
            placeholder="Describe un incidente, por ejemplo: se asustó con un perro"
            aria-label="Descripción del incidente"
            className="input-field flex-1"
          />
          <Button type="button" variant="secondary" disabled={saving || !incident.trim()} onClick={() => void logEvent('incidente', incident)} leftIcon={<AlertTriangle size={14} />}>
            Registrar incidente
          </Button>
        </div>
        <p className="text-xs text-muted">Cada registro se guarda al momento, con la hora, en el apartado que le corresponde.</p>
      </section>

      <section aria-labelledby="walk-photos-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="walk-photos-title" className="text-sm font-semibold text-ink">Fotos del paseo</h2>
          <span className="text-xs tabular-nums text-muted">{content.mediaReferences.length}/{MAX_WALK_PHOTOS}</span>
        </div>
        {FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED ? (
          <>
            <WalkPhotos sessionId={sessionId} references={content.mediaReferences} onRemove={(reference) => void removePhoto(reference)} />
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              aria-label="Seleccionar foto del paseo"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void addPhoto(file)
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploading || saving || content.mediaReferences.length >= MAX_WALK_PHOTOS}
              isLoading={uploading}
              onClick={() => fileInput.current?.click()}
              leftIcon={<Camera size={14} />}
            >
              Tomar o subir foto
            </Button>
            <p className="text-xs text-muted">Son privadas: solo las ven esta familia y administración, mediante enlaces que caducan.</p>
          </>
        ) : (
          <p className="rounded-xl bg-ink/[0.03] px-4 py-3 text-sm text-muted">Fotos privadas no disponibles todavía. No se almacenarán URLs públicas como contenido privado.</p>
        )}
      </section>

      <section aria-labelledby="walk-notes-title" className="space-y-4">
        <h2 id="walk-notes-title" className="text-sm font-semibold text-ink">Notas del paseo</h2>
        {(['summary', 'behaviorNotes', 'bathroomNotes', 'incidentsSummary'] as const).map((key) => {
          const textLimit = WALK_REPORT_TEXT_LIMITS[key]
          return (
            <label
              key={key}
              // El botón "Reportar incidencia" del paseo en curso abre la
              // bitácora directo en este campo.
              id={key === 'incidentsSummary' ? 'incidencia' : undefined}
              className="block scroll-mt-24"
            >
              <span className="mb-1.5 block text-sm font-semibold text-ink">{LABELS[key]}{key === 'summary' ? ' *' : ''}</span>
              <textarea
                value={content[key]}
                onChange={(event) => setField(key, event.target.value)}
                maxLength={textLimit}
                rows={key === 'summary' ? 5 : 3}
                className="min-h-24 w-full rounded-2xl border border-border bg-surface px-3 py-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <span className="mt-1 block text-right text-xs text-muted">{content[key].length}/{textLimit}</span>
            </label>
          )
        })}
        <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-ink/[0.03] px-3 text-sm text-ink">
          <input type="checkbox" checked={content.waterProvided} onChange={(event) => setField('waterProvided', event.target.checked)} className="h-5 w-5 accent-primary" />
          Se proporcionó agua
        </label>
      </section>

      {error && <p role="alert" className="rounded-2xl bg-danger-500/10 px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success-700">{message}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {!canSubmit && <p className="text-xs text-muted sm:mr-auto">Podrás enviarlo al completar el paseo.</p>}
        <Button type="button" variant="secondary" className="min-h-11" disabled={saving} onClick={() => void persist(content, 'draft', 'Borrador guardado.')}>Guardar borrador</Button>
        <Button type="submit" className="min-h-11 text-white" disabled={saving || !canSubmit} isLoading={saving}>Revisar y enviar</Button>
      </div>
    </form>
  )
}

export function ReportReadOnly({ report, sessionId }: {
  report: Pick<WalkReportContent, 'summary' | 'behaviorNotes' | 'bathroomNotes' | 'waterProvided' | 'incidentsSummary'> & { mediaReferences?: readonly string[] }
  /** When given, the report's private photos are shown too. */
  sessionId?: string
}) {
  const photos = report.mediaReferences ?? []
  return (
    <article className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-success-700">Reporte enviado</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">Resumen del paseo</h1>
      </header>
      {[['Resumen', report.summary], ['Comportamiento', report.behaviorNotes], ['Baño y necesidades', report.bathroomNotes], ['Incidencias', report.incidentsSummary]]
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <section key={label}>
            <h2 className="text-sm font-semibold text-ink">{label}</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{value}</p>
          </section>
        ))}
      <p className="text-sm text-muted">Agua: {report.waterProvided ? 'Sí' : 'No registrado'}</p>
      {sessionId && photos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink">Fotos del paseo</h2>
          <WalkPhotos sessionId={sessionId} references={photos} />
        </section>
      )}
    </article>
  )
}
