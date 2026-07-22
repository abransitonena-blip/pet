'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/firebase/config'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { FaClipboardList, FaSearch, FaFilter } from 'react-icons/fa'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')

  useEffect(() => {
    const q = query(collection(db, 'audit-logs'), orderBy('timestamp', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

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
            placeholder="Buscar en logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
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
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${ACTION_COLORS[log.action] || 'bg-white/10 text-white/40'}`}>
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
              <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                {formatTimestamp(log.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
