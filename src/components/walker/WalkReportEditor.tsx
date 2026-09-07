'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Card, ErrorState, LoadingState } from '@/components/ui'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { persistWalkReport, useWalkReport } from '@/lib/useWalkReport'
import { WALK_REPORT_TEXT_LIMITS, validateWalkReportContent, type WalkReportContent } from '@/lib/walkReports'

const EMPTY_REPORT: WalkReportContent = {
  summary: '', behaviorNotes: '', bathroomNotes: '', waterProvided: false, incidentsSummary: '', mediaReferences: [],
}

export default function WalkReportEditor({ sessionId }: { sessionId: string }) {
  const { report, state } = useWalkReport(sessionId, 'live')
  const [content, setContent] = useState<WalkReportContent>(EMPTY_REPORT)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const operationInFlight = useRef(false)

  useEffect(() => {
    if (!report) return
    setContent({
      summary: report.summary,
      behaviorNotes: report.behaviorNotes,
      bathroomNotes: report.bathroomNotes,
      waterProvided: report.waterProvided,
      incidentsSummary: report.incidentsSummary,
      mediaReferences: report.mediaReferences,
    })
  }, [report])

  if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED || state === 'unavailable') {
    return <Card className="p-5 shadow-none"><p className="font-semibold text-ink">Reportes en preparación</p><p className="mt-1 text-sm text-muted">La captura se habilitará cuando las reglas canónicas sean publicadas. Las fotos privadas continúan desactivadas.</p></Card>
  }
  if (state === 'loading') return <LoadingState message="Cargando reporte…" rows={3} />
  if (state === 'permission-denied' || state === 'network-error') {
    return <ErrorState description={state === 'permission-denied' ? 'No tienes permiso para consultar este reporte.' : 'No pudimos consultar el reporte. Revisa tu conexión.'} />
  }
  if (report?.status === 'submitted') return <ReportReadOnly report={report} />

  const setField = <K extends keyof WalkReportContent>(key: K, value: WalkReportContent[K]) => setContent((current) => ({ ...current, [key]: value }))
  const save = async (mode: 'draft' | 'submit') => {
    if (operationInFlight.current) return
    const errors = validateWalkReportContent(content, mode)
    if (errors.length > 0) {
      setError(errors[0] === 'summary-required' ? 'Escribe un resumen antes de enviar.' : 'Revisa los límites de texto del reporte.')
      return
    }
    if (mode === 'submit' && !window.confirm('¿Enviar este reporte? Después no podrás modificarlo.')) return
    operationInFlight.current = true
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await persistWalkReport({ sessionId, content, mode })
      setMessage(mode === 'submit' ? 'Reporte enviado.' : 'Borrador guardado.')
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      setError(code === 'walk-session-not-completed'
        ? 'La sesión debe estar completada antes de enviar.'
        : code === 'walk-report-already-submitted'
          ? 'Este reporte ya fue enviado y no admite cambios.'
          : code === 'walk-session-not-found'
            ? 'La sesión ya no está disponible.'
            : code.includes('permission-denied')
              ? 'Ya no tienes permiso. Verifica que la sesión siga asignada a tu cuenta y que tu perfil esté activo.'
              : 'No pudimos guardar el reporte. Revisa tu conexión e inténtalo nuevamente.')
    } finally {
      operationInFlight.current = false
      setSaving(false)
    }
  }

  const labels = { summary: 'Resumen', behaviorNotes: 'Comportamiento', bathroomNotes: 'Baño y necesidades', incidentsSummary: 'Incidencias' }
  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void save('submit') }}>
      <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Reporte del paseo</p><h1 className="mt-1 text-2xl font-bold text-ink">Documenta lo importante</h1><p className="mt-1 text-sm text-muted">El borrador es privado. La Familia solo podrá leerlo después de enviarlo.</p></header>
      {(['summary', 'behaviorNotes', 'bathroomNotes', 'incidentsSummary'] as const).map((key) => {
        const textLimit = WALK_REPORT_TEXT_LIMITS[key]
        return <label key={key} className="block"><span className="mb-1.5 block text-sm font-semibold text-ink">{labels[key]}{key === 'summary' ? ' *' : ''}</span><textarea value={content[key]} onChange={(event) => setField(key, event.target.value)} maxLength={textLimit} rows={key === 'summary' ? 5 : 3} className="min-h-24 w-full rounded-xl border border-ink/15 bg-surface px-3 py-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary" /><span className="mt-1 block text-right text-xs text-muted">{content[key].length}/{textLimit}</span></label>
      })}
      <label className="flex min-h-11 items-center gap-3 rounded-xl bg-ink/[0.03] px-3 text-sm text-ink"><input type="checkbox" checked={content.waterProvided} onChange={(event) => setField('waterProvided', event.target.checked)} className="h-5 w-5 accent-primary" />Se proporcionó agua</label>
      <p className="rounded-xl bg-ink/[0.03] px-4 py-3 text-sm text-muted">Fotos privadas no disponibles todavía. No se almacenarán URLs públicas como contenido privado.</p>
      {error && <p role="alert" className="rounded-xl bg-danger-500/10 px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success-700">{message}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" className="min-h-11" disabled={saving} onClick={() => void save('draft')}>Guardar borrador</Button><Button type="submit" className="min-h-11 text-white" disabled={saving} isLoading={saving}>Revisar y enviar</Button></div>
    </form>
  )
}

export function ReportReadOnly({ report }: { report: Pick<WalkReportContent, 'summary' | 'behaviorNotes' | 'bathroomNotes' | 'waterProvided' | 'incidentsSummary'> }) {
  return <article className="space-y-4"><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-success-700">Reporte enviado</p><h1 className="mt-1 text-2xl font-bold text-ink">Resumen del paseo</h1></header>{[['Resumen', report.summary], ['Comportamiento', report.behaviorNotes], ['Baño y necesidades', report.bathroomNotes], ['Incidencias', report.incidentsSummary]].filter(([, value]) => value).map(([label, value]) => <section key={label}><h2 className="text-sm font-semibold text-ink">{label}</h2><p className="mt-1 whitespace-pre-wrap text-sm text-muted">{value}</p></section>)}<p className="text-sm text-muted">Agua: {report.waterProvided ? 'Sí' : 'No registrado'}</p></article>
}
