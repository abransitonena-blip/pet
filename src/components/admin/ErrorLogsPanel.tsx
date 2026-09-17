'use client'

import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, type DocumentData, type FirestoreError } from 'firebase/firestore'
import { AlertOctagon } from 'lucide-react'
import { db } from '@/firebase/db'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { ROLES } from '@/lib/roles'
import { useSessionRole } from '@/lib/useSessionRole'

interface ErrorLogEntry {
  id: string
  message: string
  context: string | null
  url: string | null
  uid: string
  createdAt: string | null
}

type LoadState = 'loading' | 'ready' | 'permission' | 'network'

function parseEntry(id: string, data: DocumentData): ErrorLogEntry {
  return {
    id,
    message: typeof data.message === 'string' ? data.message : 'Sin mensaje',
    context: typeof data.context === 'string' ? data.context : null,
    url: typeof data.url === 'string' ? data.url : null,
    uid: typeof data.uid === 'string' ? data.uid : 'desconocido',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
  }
}

function classifyReadError(error: FirestoreError | unknown): 'permission' | 'network' {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  return code.includes('permission-denied') ? 'permission' : 'network'
}

export default function ErrorLogsPanel() {
  const session = useSessionRole([ROLES.ADMIN])
  const [state, setState] = useState<LoadState>('loading')
  const [entries, setEntries] = useState<ErrorLogEntry[]>([])

  const load = useCallback(async () => {
    if (session.status !== 'ready') return
    setState('loading')
    try {
      const snapshot = await getDocs(query(collection(db, 'errorLogs'), orderBy('createdAt', 'desc'), limit(50)))
      setEntries(snapshot.docs.map((item) => parseEntry(item.id, item.data())))
      setState('ready')
    } catch (error) {
      setState(classifyReadError(error))
    }
  }, [session.status])

  useEffect(() => { void load() }, [load])

  if (session.status === 'loading') return <LoadingState message="Verificando acceso administrativo…" rows={3} />
  if (session.status !== 'ready') {
    return <ErrorState title="Acceso exclusivo de Admin" description="Esta herramienta requiere un custom claim admin explícito." onRetry={() => void session.refresh()} />
  }
  if (state === 'loading') return <LoadingState message="Consultando errores recientes…" rows={4} />
  if (state === 'permission' || state === 'network') {
    return <ErrorState description={state === 'permission' ? 'No tienes permiso para consultar los errores.' : 'No pudimos consultar los errores.'} onRetry={() => void load()} />
  }
  if (entries.length === 0) {
    return <EmptyState icon={<AlertOctagon aria-hidden="true" />} title="Sin errores registrados" description="No se ha reportado ningún error de aplicación todavía. Máximo 50 registros recientes." />
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Últimos 50 errores reportados desde el navegador. No incluye errores previos al inicio de sesión.</p>
      {entries.map((entry) => (
        <article key={entry.id} className="rounded-xl border border-danger/20 bg-surface p-4" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{entry.message}</p>
            <span className="text-xs text-muted">{entry.createdAt ? new Date(entry.createdAt).toLocaleString('es-MX') : 'Sin fecha'}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{entry.context ?? 'Contexto no especificado'} · {entry.url ?? 'Ruta desconocida'} · usuario {entry.uid.slice(0, 8)}</p>
        </article>
      ))}
    </div>
  )
}
