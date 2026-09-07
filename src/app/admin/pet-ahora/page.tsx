'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, limit } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion } from 'framer-motion'
import { Zap, Ban, CheckCircle2, Loader2, Dog, Search } from 'lucide-react'
import type { PetAhoraRequest } from '@/types'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { Button, Card, EmptyState } from '@/components/ui'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  searching: 'Buscando',
  offer_sent: 'Oferta enviada',
  accepted: 'Aceptado',
  en_camino: 'En camino',
  paseando: 'Paseando',
  completed: 'Completado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'gray',
  searching: 'amber',
  offer_sent: 'amber',
  accepted: 'blue',
  en_camino: 'blue',
  paseando: 'green',
  completed: 'green',
  cancelled: 'red',
  expired: 'gray',
}

const STATUS_CSS: Record<string, { text: string; bg: string }> = {
  gray: { text: 'var(--text-muted)', bg: 'color-mix(in srgb, var(--text-muted) 12%, transparent)' },
  amber: { text: 'var(--color-warning)', bg: 'color-mix(in srgb, var(--color-warning) 12%, transparent)' },
  blue: { text: 'var(--color-info)', bg: 'color-mix(in srgb, var(--color-info) 12%, transparent)' },
  green: { text: 'var(--color-success)', bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)' },
  red: { text: 'var(--color-danger)', bg: 'color-mix(in srgb, var(--color-danger) 12%, transparent)' },
}

function statusStyle(status: string) {
  return STATUS_CSS[STATUS_STYLE[status] || 'gray'] || STATUS_CSS.gray
}

export default function AdminPetAhoraPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<PetAhoraRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED) { setLoading(false); return }
    const q = query(collection(db, 'petAhoraRequests'), orderBy('requestedAt', 'desc'), limit(200))
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PetAhoraRequest)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const handleCancel = async (id: string) => {
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED) return
    setActionLoading(id)
    try {
      await updateDoc(doc(db, 'petAhoraRequests', id), { status: 'cancelled', cancelledAt: Timestamp.now(), cancellationReason: 'admin' })
    } catch (err) {
      console.error('Error cancelling PET Ahora request:', err)
    }
    setActionLoading(null)
  }

  const handleForceComplete = async (id: string) => {
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED) return
    setActionLoading(id)
    try {
      await updateDoc(doc(db, 'petAhoraRequests', id), { status: 'completed', completedAt: Timestamp.now() })
    } catch (err) {
      console.error('Error force-completing PET Ahora request:', err)
    }
    setActionLoading(null)
  }

  const filtered = requests.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.petName?.toLowerCase().includes(q) && !r.walkerName?.toLowerCase().includes(q) && !r.id?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending' || r.status === 'searching' || r.status === 'offer_sent').length,
    active: requests.filter((r) => ['accepted', 'en_camino', 'paseando'].includes(r.status)).length,
    completed: requests.filter((r) => r.status === 'completed').length,
    cancelled: requests.filter((r) => r.status === 'cancelled' || r.status === 'expired').length,
  }

  if (!FEATURE_FLAGS.PET_AHORA_ENABLED) {
    return (
      <Card className="p-8 text-center" data-testid="admin-pet-ahora-unavailable">
        <Zap className="mx-auto mb-3 text-secondary" size={28} />
        <h1 className="text-xl font-bold">PET Ahora está temporalmente en preparación</h1>
        <p className="text-sm text-muted mt-2 mb-4">No se crearán solicitudes, ofertas, leases ni asignaciones mientras el backend seguro no esté disponible.</p>
        <Button onClick={() => router.push('/admin/reservas')}>Ver paseos programados</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.1)' }}>
            <Zap className="text-secondary" size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>PET Ahora</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Solicitudes de paseo instantáneo</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { key: 'all', label: 'Todas', count: counts.all },
          { key: 'pending', label: 'Pendientes', count: counts.pending },
          { key: 'active', label: 'Activas', count: counts.active },
          { key: 'completed', label: 'Completadas', count: counts.completed },
          { key: 'cancelled', label: 'Canceladas', count: counts.cancelled },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-xl p-3 text-center transition-all ${
              filter === s.key ? 'bg-primary text-white' : 'border border-ink/10 bg-surface text-ink shadow-sm'
            }`}
          >
            <p className="text-lg font-bold">{s.count}</p>
            <p className="text-2xs opacity-80">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar por perro, paseador o ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-8 text-sm"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={20} style={{ color: 'var(--text-muted)' }} /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8">
          <EmptyState icon={<Zap size={28} />} title="No hay solicitudes" />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.02 }}
              className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: statusStyle(r.status).bg }}>
                {r.status === 'completed' ? <CheckCircle2 size={13} style={{ color: statusStyle(r.status).text }} /> :
                 r.status === 'cancelled' || r.status === 'expired' ? <Ban size={13} style={{ color: statusStyle(r.status).text }} /> :
                 <Dog size={13} style={{ color: statusStyle(r.status).text }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.petName}</p>
                  <span className="text-2xs px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: statusStyle(r.status).bg, color: statusStyle(r.status).text }}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {r.walkerName && <span>{r.walkerName}</span>}
                  {r.walkerName && r.address && <span>·</span>}
                  {r.address && <span>{r.address.street}</span>}
                  {r.requestedAt && (
                    <><span>·</span><span>{new Date(r.requestedAt.seconds * 1000).toLocaleString('es-MX')}</span></>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {['accepted', 'en_camino', 'paseando'].includes(r.status) && (
                  <Button
                    variant="icon"
                    onClick={() => handleForceComplete(r.id)}
                    isLoading={actionLoading === r.id}
                    className="bg-success-500/10 text-success-600 hover:bg-success-500/20"
                    aria-label="Forzar completado"
                  >
                    <CheckCircle2 size={10} />
                  </Button>
                )}
                {!['completed', 'cancelled', 'expired'].includes(r.status) && (
                  <Button
                    variant="icon"
                    onClick={() => handleCancel(r.id)}
                    isLoading={actionLoading === r.id}
                    className="bg-danger-500/10 text-danger-400 hover:bg-danger-500/20"
                    aria-label="Cancelar"
                  >
                    <Ban size={10} />
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
