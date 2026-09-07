'use client'

import { useParams } from 'next/navigation'
import { Card, ErrorState, LoadingState } from '@/components/ui'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { useWalkReport } from '@/lib/useWalkReport'
import { ReportReadOnly } from '@/components/walker/WalkReportEditor'

export default function FamilyReportPage() {
  const params = useParams<{ sessionId: string }>()
  const { report, state } = useWalkReport(params.sessionId)
  if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED || state === 'unavailable') return <Card className="p-5 shadow-none"><p className="font-semibold text-ink">Reporte no disponible</p><p className="mt-1 text-sm text-muted">Los reportes canónicos todavía no están habilitados.</p></Card>
  if (state === 'loading') return <LoadingState message="Consultando reporte…" rows={3} />
  if (state === 'permission-denied') return <ErrorState description="No tienes permiso para consultar este reporte." />
  if (state === 'network-error') return <ErrorState description="No pudimos consultar el reporte. Revisa tu conexión." />
  if (!report || report.status !== 'submitted') return <Card className="p-5 shadow-none"><p className="font-semibold text-ink">Aún no hay reporte</p><p className="mt-1 text-sm text-muted">El reporte aparecerá cuando el paseador lo envíe.</p></Card>
  return <ReportReadOnly report={report} />
}
