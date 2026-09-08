'use client'

import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, type DocumentData, type FirestoreError } from 'firebase/firestore'
import { MessageSquareHeart } from 'lucide-react'
import { db } from '@/firebase/config'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { ROLES } from '@/lib/roles'
import { useSessionRole } from '@/lib/useSessionRole'

interface FeedbackEntry {
  id: string
  message: string
  category: string
  customerId: string
  createdAt: string | null
}

type LoadState = 'loading' | 'ready' | 'permission' | 'network'

const CATEGORY_LABEL: Record<string, string> = {
  sugerencia: 'Sugerencia', elogio: 'Elogio', queja: 'Queja', otro: 'Otro',
}

function parseEntry(id: string, data: DocumentData): FeedbackEntry {
  return {
    id,
    message: typeof data.message === 'string' ? data.message : '',
    category: typeof data.category === 'string' ? data.category : 'otro',
    customerId: typeof data.customerId === 'string' ? data.customerId : 'desconocido',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
  }
}

function classifyReadError(error: FirestoreError | unknown): 'permission' | 'network' {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  return code.includes('permission-denied') ? 'permission' : 'network'
}

export default function FeedbackPanel() {
  const session = useSessionRole([ROLES.ADMIN])
  const [state, setState] = useState<LoadState>('loading')
  const [entries, setEntries] = useState<FeedbackEntry[]>([])

  const load = useCallback(async () => {
    if (session.status !== 'ready') return
    setState('loading')
    try {
      const snapshot = await getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(50)))
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
  if (state === 'loading') return <LoadingState message="Consultando comentarios…" rows={4} />
  if (state === 'permission' || state === 'network') {
    return <ErrorState description={state === 'permission' ? 'No tienes permiso para consultar los comentarios.' : 'No pudimos consultar los comentarios.'} onRetry={() => void load()} />
  }
  if (entries.length === 0) {
    return <EmptyState icon={<MessageSquareHeart aria-hidden="true" />} title="Sin comentarios todavía" description="Los mensajes que las familias envíen desde Familia PET aparecerán aquí. Máximo 50 recientes." />
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <article key={entry.id} className="rounded-xl border border-ink/10 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink">{CATEGORY_LABEL[entry.category] ?? entry.category}</span>
            <span className="text-xs text-muted">{entry.createdAt ? new Date(entry.createdAt).toLocaleString('es-MX') : 'Sin fecha'}</span>
          </div>
          <p className="mt-2 text-sm text-ink">{entry.message}</p>
          <p className="mt-1 text-xs text-muted">Cliente {entry.customerId.slice(0, 8)}</p>
        </article>
      ))}
    </div>
  )
}
