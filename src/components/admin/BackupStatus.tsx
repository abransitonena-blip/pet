'use client'

import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, type DocumentData, type FirestoreError } from 'firebase/firestore'
import { AlertTriangle, DatabaseBackup } from 'lucide-react'
import { db } from '@/firebase/db'
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { ROLES } from '@/lib/roles'
import { useSessionRole } from '@/lib/useSessionRole'

type RunStatus = 'started' | 'success' | 'failed'

interface BackupRun {
  status: RunStatus
  startedAt: Date | null
  finishedAt: Date | null
  outputUriPrefix?: string
  errorMessage?: string
}

type LoadState = 'loading' | 'ready' | 'empty' | 'permission' | 'network'

const STALE_AFTER_HOURS = 26

function toDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
  }
  return null
}

function parseRun(data: DocumentData): BackupRun {
  const status: RunStatus = data.status === 'success' || data.status === 'failed' ? data.status : 'started'
  return {
    status,
    startedAt: toDate(data.startedAt),
    finishedAt: toDate(data.finishedAt),
    outputUriPrefix: typeof data.outputUriPrefix === 'string' ? data.outputUriPrefix : undefined,
    errorMessage: typeof data.errorMessage === 'string' ? data.errorMessage : undefined,
  }
}

function classifyReadError(error: FirestoreError | unknown): 'permission' | 'network' {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  return code.includes('permission-denied') ? 'permission' : 'network'
}

const STATUS_STYLE: Record<RunStatus, string> = {
  success: 'bg-primary/10 text-primary',
  started: 'bg-ink/5 text-muted',
  failed: 'bg-danger/10 text-danger',
}

const STATUS_LABEL: Record<RunStatus, string> = {
  success: 'Exitoso',
  started: 'En curso',
  failed: 'Fallido',
}

export default function BackupStatus() {
  const session = useSessionRole([ROLES.ADMIN])
  const [state, setState] = useState<LoadState>('loading')
  const [run, setRun] = useState<BackupRun | null>(null)

  const load = useCallback(async () => {
    if (session.status !== 'ready') return
    setState('loading')
    try {
      const snapshot = await getDocs(query(collection(db, 'backupRuns'), orderBy('startedAt', 'desc'), limit(1)))
      if (snapshot.empty) { setState('empty'); return }
      setRun(parseRun(snapshot.docs[0].data()))
      setState('ready')
    } catch (error) {
      setState(classifyReadError(error))
    }
  }, [session.status])

  useEffect(() => { void load() }, [load])

  if (session.status === 'loading') return <LoadingState message="Verificando acceso administrativo…" rows={2} />
  if (session.status !== 'ready') return null

  return (
    <Card className="space-y-4 p-4 sm:p-5" aria-labelledby="backup-status-title">
      <div className="flex items-start gap-3">
        <DatabaseBackup className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden="true" />
        <div>
          <h2 id="backup-status-title" className="font-semibold text-ink">Respaldos de Firestore</h2>
          <p className="mt-1 text-sm text-muted">Exportación programada diaria a Cloud Storage. Solo lectura — no crea ni modifica datos.</p>
        </div>
      </div>

      {state === 'loading' && <LoadingState message="Consultando el último respaldo…" rows={2} />}
      {(state === 'permission' || state === 'network') && (
        <ErrorState
          description={state === 'permission' ? 'No tienes permiso para consultar los respaldos.' : 'No pudimos consultar los respaldos.'}
          onRetry={() => void load()}
        />
      )}
      {state === 'empty' && (
        <EmptyState
          icon={<AlertTriangle aria-hidden="true" />}
          title="Todavía no corre ningún respaldo"
          description="La función programada aún no se ha ejecutado o no se ha desplegado. Revisa Cloud Scheduler."
        />
      )}
      {state === 'ready' && run && (() => {
        const hoursSince = run.startedAt ? (Date.now() - run.startedAt.getTime()) / 3_600_000 : null
        const stale = hoursSince !== null && hoursSince > STALE_AFTER_HOURS
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[run.status]}`}>{STATUS_LABEL[run.status]}</span>
              {stale && <span className="inline-flex rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger" role="status">Respaldo atrasado — revisa Cloud Scheduler</span>}
            </div>
            <dl className="grid gap-2 text-xs text-muted sm:grid-cols-2">
              <div><dt className="font-semibold text-ink">Iniciado</dt><dd>{run.startedAt ? run.startedAt.toLocaleString('es-MX') : 'Sin fecha registrada'}</dd></div>
              <div><dt className="font-semibold text-ink">Finalizado</dt><dd>{run.finishedAt ? run.finishedAt.toLocaleString('es-MX') : 'Todavía en curso'}</dd></div>
              {run.outputUriPrefix && <div className="sm:col-span-2"><dt className="font-semibold text-ink">Destino</dt><dd className="break-all">{run.outputUriPrefix}</dd></div>}
              {run.errorMessage && <div role="alert" className="sm:col-span-2"><dt className="font-semibold text-danger">Error</dt><dd className="break-words">{run.errorMessage}</dd></div>}
            </dl>
          </div>
        )
      })()}
    </Card>
  )
}
