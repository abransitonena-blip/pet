'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/firebase/config'
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { FaStar, FaTrash, FaDownload, FaSpinner, FaSearch } from 'react-icons/fa'
import { logChange } from '@/lib/audit'
import { useToast } from '@/context/ToastContext'

interface AdminReview {
  id: string
  name: string
  rating: number
  text: string
  date: string
  petName?: string
}

export default function AdminResenasPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminReview)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return reviews
    const q = searchQuery.toLowerCase()
    return reviews.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.text.toLowerCase().includes(q) ||
        (r.petName?.toLowerCase().includes(q) ?? false)
    )
  }, [reviews, searchQuery])

  const stats = useMemo(() => {
    const avg = reviews.length > 0
      ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
      : '0'
    const distribution = [0, 0, 0, 0, 0]
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++
    })
    return { avg, total: reviews.length, distribution }
  }, [reviews])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      logChange('delete', id, { col: 'reviews' })
      await deleteDoc(doc(db, 'reviews', id))
      toast('Reseña eliminada')
    } catch { toast('Error al eliminar reseña', 'error') }
    setDeleting(null)
  }

  const exportCSV = () => {
    const headers = ['Nombre', 'Calificación', 'Reseña', 'Fecha', 'Mascota']
    const rows = reviews.map((r) => [r.name, String(r.rating), r.text, r.date, r.petName || ''])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resenas-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reseñas</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {stats.total} reseñas · Calificación promedio: {stats.avg} ★
          </p>
        </div>
        <button onClick={exportCSV} className="btn-secondary !text-xs flex items-center gap-1.5">
          <FaDownload size={12} /> Exportar CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-3xl font-bold" style={{ color: '#D97706' }}>{stats.avg}</p>
          <div className="flex items-center justify-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <FaStar key={i} size={12} className={i <= Math.round(Number(stats.avg)) ? 'text-brand-400' : 'text-white/10'} />
            ))}
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Promedio</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Distribución</p>
          {[5, 4, 3, 2, 1].map((stars) => (
            <div key={stars} className="flex items-center gap-2 text-[10px] mb-0.5">
              <span style={{ color: 'var(--text-muted)', width: 12 }}>{stars}</span>
              <FaStar className="text-brand-400" size={8} />
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div
                  className="h-full rounded-full bg-brand-500/60"
                  style={{ width: `${stats.total > 0 ? (stats.distribution[stars - 1] / stats.total) * 100 : 0}%` }}
                />
              </div>
              <span style={{ color: 'var(--text-muted)', width: 16, textAlign: 'right' }}>{stats.distribution[stars - 1]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar en reseñas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FaStar className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {searchQuery ? 'Sin resultados' : 'No hay reseñas aún'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((rev) => (
            <div
              key={rev.id}
              className="rounded-xl p-4 transition-all hover:bg-white/[0.02]"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{rev.name}</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <FaStar key={i} className="text-brand-400" size={10} />
                      ))}
                      {Array.from({ length: 5 - rev.rating }).map((_, i) => (
                        <FaStar key={`empty-${i}`} className="text-white/10" size={10} />
                      ))}
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{rev.date}</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{rev.text}</p>
                  {rev.petName && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>🐾 {rev.petName}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(rev.id)}
                  disabled={deleting === rev.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 text-danger-400 shrink-0"
                  title="Eliminar"
                >
                  {deleting === rev.id ? <FaSpinner className="animate-spin" size={11} /> : <FaTrash size={11} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
