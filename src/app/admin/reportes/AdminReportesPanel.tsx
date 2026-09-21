'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, type FirestoreError } from 'firebase/firestore'
import { FileText, SearchX } from 'lucide-react'
import { db } from '@/firebase/db'
import { Button, Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import type { WalkReport } from '@/lib/walkReports'

function abbreviated(value: string): string {
  return value.length > 8 ? `${value.slice(0, 6)}…` : value
}

function reportDate(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
  }
  return 'Fecha pendiente'
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<WalkReport[]>([])
  const [filter, setFilter] = useState<'all' | 'draft' | 'submitted'>('all')
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<'loading' | 'ready' | 'permission' | 'network' | 'unavailable'>(FEATURE_FLAGS.WALK_REPORTS_ENABLED ? 'loading' : 'unavailable')
  useEffect(() => {
    if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED) return
    let active = true
    void getDocs(query(collection(db, 'walkReports'), orderBy('updatedAt', 'desc'), limit(50))).then((snapshot) => {
      if (!active) return
      setReports(snapshot.docs.map((item) => item.data() as WalkReport))
      setState('ready')
    }).catch((error: FirestoreError) => {
      if (active) setState(error.code === 'permission-denied' ? 'permission' : 'network')
    })
    return () => { active = false }
  }, [revision])
  const filteredReports = useMemo(
    () => filter === 'all' ? reports : reports.filter((report) => report.status === filter),
    [filter, reports],
  )
  if (state === 'unavailable') return <Card className="p-5 shadow-none"><h1 className="text-xl font-bold text-ink">Reportes de paseo</h1><p className="mt-2 text-sm text-muted">La consulta se habilitará después de publicar y verificar las reglas canónicas.</p></Card>
  if (state === 'loading') return <LoadingState message="Cargando reportes…" rows={5} />
  if (state === 'permission' || state === 'network') {
    return (
      <ErrorState
        description={state === 'permission' ? 'No tienes permiso para consultar reportes.' : 'No pudimos consultar los reportes.'}
        onRetry={() => {
          setState('loading')
          setRevision((value) => value + 1)
        }}
      />
    )
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-ink">Reportes de paseo</h1>
        <p className="text-sm text-muted">Últimos 50 reportes. Consulta operativa de solo lectura.</p>
      </header>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar reportes">
        {([{ value: 'all', label: 'Todos' }, { value: 'draft', label: 'Borradores' }, { value: 'submitted', label: 'Enviados' }] as const).map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={filter === item.value ? 'primary' : 'ghost'}
            className={`h-11 shrink-0 ${filter === item.value ? 'text-white' : ''}`}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {reports.length === 0 ? (
        <EmptyState illustration="durmiendo" icon={<FileText size={24} />} title="Sin reportes" description="Los borradores y reportes enviados aparecerán aquí." />
      ) : filteredReports.length === 0 ? (
        <EmptyState illustration="olfateando" icon={<SearchX size={24} />} title="Sin resultados" description="No hay reportes con este estado dentro de los últimos 50." />
      ) : (
        <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-surface">
          {filteredReports.map((report) => (
            <article key={report.walkSessionId} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-sm font-semibold text-ink">Sesión {abbreviated(report.walkSessionId)}</p><p className="mt-1 text-xs text-muted">{reportDate(report.updatedAt)}</p></div>
                <StatusBadge status={report.status} />
              </div>
              <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                <div><dt className="font-semibold text-ink">Perro</dt><dd>{report.dogIds.map(abbreviated).join(', ')}</dd></div>
                <div><dt className="font-semibold text-ink">Paseador</dt><dd>{abbreviated(report.walkerId)}</dd></div>
              </dl>
              <p className="mt-3 line-clamp-2 text-sm text-muted">{report.summary || 'Borrador sin resumen'}</p>
              {report.incidentsSummary && <p className="mt-2 text-sm font-medium text-red-700">Incidencia registrada</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
