'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/firebase/config'
import { collection, query, orderBy, limit, getDocs, startAfter as firestoreStartAfter, DocumentSnapshot, QueryConstraint } from 'firebase/firestore'
import { FaClipboardList, FaSearch } from 'react-icons/fa'

interface AuditLog {
  id: string
  action: string
  reservationId: string
  details: Record<string, unknown>
  userId: string
  timestamp: { seconds: number; nanoseconds: number } | null
}

const ACTION_LABELS: Record<string, string> = {
  delete: 'Eliminación',
  payment_toggle: 'Cambio de pago',
  status_change: 'Cambio de estado',
  edit: 'Edición',
  create: 'Creación',
}

const ACTION_COLORS: Record<string, string> = {
  delete: 'bg-danger-500/15 text-danger-400',
  payment_toggle: 'bg-brand-500/15 text-brand-400',
  status_change: 'bg-blue-500/15 text-blue-400',
  edit: 'bg-blue-500/15 text-blue-400',
  create: 'bg-success-500/15 text-success-400',
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')

  const PAGE_SIZE = 50

  const fetchLogs = async (isLoadMore = false) => {
    try {
      const constraints: QueryConstraint[] = [orderBy('timestamp', 'desc'), limit(PAGE_SIZE)]
      if (isLoadMore && lastDoc) constraints.push(firestoreStartAfter(lastDoc))

      const q = query(collection(db, 'audit-logs'), ...constraints)
      const snap = await getDocs(q)

      const newLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog))
      setLogs((prev) => isLoadMore ? [...prev, ...newLogs] : newLogs)
      setHasMore(newLogs.length === PAGE_SIZE)
      setLastDoc(snap.docs[snap.docs.length - 1] || null)
    } catch { /* ignore */ }
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => { fetchLogs(false) }, [])

  const loadMore = () => {
    setLoadingMore(true)
    fetchLogs(true)
  }

  const filtered = useMemo(() => {
    let result = logs
    if (actionFilter !== 'all') {
      result = result.filter((l) => l.action === actionFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.reservationId.toLowerCase().includes(q) ||
          l.userId.toLowerCase().includes(q) ||
          JSON.stringify(l.details).toLowerCase().includes(q)
      )
    }
    return result
  }, [logs, searchQuery, actionFilter])

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs])

  const formatTimestamp = (ts: { seconds: number; nanoseconds: number } | null) => {
    if (!ts) return '—'
    const date = new Date(ts.seconds * 1000)
    return date.toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Logs de Auditoría</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Historial de acciones realizadas en el sistema
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            aria-label="Buscar en logs" placeholder="Buscar en logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select aria-label="Filtrar por acción"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input-field !w-auto"
        >
          <option value="all">Todas las acciones</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FaClipboardList className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {searchQuery || actionFilter !== 'all' ? 'Sin resultados' : 'No hay logs de auditoría'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-white/[0.02]"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <span className={`text-2xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ACTION_COLORS[log.action] || 'bg-white/10 text-white/40'}`}>
                {ACTION_LABELS[log.action] || log.action}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {log.reservationId && <span>ID: {log.reservationId.slice(0, 12)}...</span>}
                  {log.details && Object.keys(log.details).length > 0 && (
                    <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                      {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-2xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                {formatTimestamp(log.timestamp)}
              </span>
            </div>
          ))}
          {hasMore && !searchQuery && actionFilter === 'all' && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-2.5 text-xs font-medium rounded-xl transition-all"
              style={{ background: 'var(--glass-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {loadingMore ? 'Cargando...' : 'Cargar más'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
