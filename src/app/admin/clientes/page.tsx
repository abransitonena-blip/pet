'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReservations } from '@/context/ReservationsContext'
import {
  FaSearch, FaUsers, FaWhatsapp, FaDog, FaCalendarAlt, FaMoneyBill, FaStar,
  FaClock, FaUserFriends, FaTimes, FaCrown, FaHeart, FaExclamationTriangle,
} from 'react-icons/fa'
import { getServicePrice } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import Badge from '@/components/ui/Badge'
import type { Reservation } from '@/types'

interface Client {
  name: string
  phone: string
  reservations: Reservation[]
  petNames: string[]
  totalSpent: number
  lastVisit: string
  firstVisit: string
  ltv: number
  avgFrequency: number
  segment: 'vip' | 'regular' | 'new' | 'at_risk' | 'churned'
  completedCount: number
  cancelledCount: number
  avgRating: number
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a)
  const db = new Date(b)
  return Math.abs(Math.round((db.getTime() - da.getTime()) / 86400000))
}

function relativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const days = Math.round((now.getTime() - date.getTime()) / 86400000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.round(days / 7)} sem`
  if (days < 365) return `Hace ${Math.round(days / 30)} mes${Math.round(days / 30) !== 1 ? 'es' : ''}`
  return `Hace ${Math.round(days / 365)} año${Math.round(days / 365) !== 1 ? 's' : ''}`
}

const SEGMENT_CONFIG: Record<string, { label: string; color: string; icon: typeof FaCrown }> = {
  vip: { label: 'VIP', color: 'text-warning-400 bg-warning-500/15', icon: FaCrown },
  regular: { label: 'Frecuente', color: 'text-success-400 bg-success-500/15', icon: FaHeart },
  new: { label: 'Nuevo', color: 'text-blue-400 bg-blue-500/15', icon: FaDog },
  at_risk: { label: 'En riesgo', color: 'text-orange-400 bg-orange-500/15', icon: FaExclamationTriangle },
  churned: { label: 'Inactivo', color: 'text-white/40 bg-white/5', icon: FaClock },
}

export default function AdminClientesPage() {
  const { reservations, loading } = useReservations()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [segmentFilter, setSegmentFilter] = useState<string>('all')
  const { prices } = usePrices()

  const clients = useMemo(() => {
    const map = new Map<string, Client>()
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]

    reservations.forEach((r) => {
      const key = r.phone
      if (!map.has(key)) {
        map.set(key, {
          name: r.name,
          phone: r.phone,
          reservations: [],
          petNames: [],
          totalSpent: 0,
          lastVisit: r.date,
          firstVisit: r.date,
          ltv: 0,
          avgFrequency: 0,
          segment: 'new',
          completedCount: 0,
          cancelledCount: 0,
          avgRating: 0,
        })
      }
      const c = map.get(key)!
      c.reservations.push(r)
      if (!c.petNames.includes(r.petName)) c.petNames.push(r.petName)
      if (r.paymentStatus === 'paid') {
        const price = prices[r.service] ?? getServicePrice(r.service)
        c.totalSpent += price
      }
      if (r.date > c.lastVisit) c.lastVisit = r.date
      if (r.date < c.firstVisit) c.firstVisit = r.date
      if (r.status === 'completed') c.completedCount++
      if (r.status === 'cancelled') c.cancelledCount++
    })

    // Compute LTV, frequency, segment
    const result = Array.from(map.values()).map((c) => {
      c.ltv = c.totalSpent

      // Avg frequency (days between visits)
      if (c.reservations.length > 1) {
        const sorted = [...c.reservations].sort((a, b) => a.date.localeCompare(b.date))
        let totalDays = 0
        for (let i = 1; i < sorted.length; i++) {
          totalDays += daysBetween(sorted[i - 1].date, sorted[i].date)
        }
        c.avgFrequency = Math.round(totalDays / (sorted.length - 1))
      }

      // Segment
      const count = c.completedCount
      const lastVisitDays = daysBetween(c.lastVisit, today)

      if (count >= 10 && c.ltv >= 2000) c.segment = 'vip'
      else if (count >= 3) c.segment = 'regular'
      else if (count <= 1 && lastVisitDays <= 30) c.segment = 'new'
      else if (lastVisitDays > 30 && lastVisitDays <= 60) c.segment = 'at_risk'
      else if (lastVisitDays > 60) c.segment = 'churned'

      return c
    })

    return result.sort((a, b) => b.ltv - a.ltv)
  }, [reservations, prices])

  const filtered = useMemo(() => {
    let result = clients
    if (segmentFilter !== 'all') {
      result = result.filter((c) => c.segment === segmentFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.petNames.some((p) => p.toLowerCase().includes(q))
      )
    }
    return result
  }, [clients, searchQuery, segmentFilter])

  const stats = useMemo(() => {
    const uniquePhones = new Set(reservations.map((r) => r.phone))
    const today = new Date().toISOString().split('T')[0]
    const thisMonth = new Date(today.slice(0, 7) + '-01').toISOString().split('T')[0]
    return {
      totalClients: uniquePhones.size,
      activeClients: new Set(reservations.filter((r) => r.date >= thisMonth).map((r) => r.phone)).size,
      totalReservations: reservations.length,
      repeatClients: clients.filter((c) => c.reservations.length > 1).length,
      vipClients: clients.filter((c) => c.segment === 'vip').length,
      atRiskClients: clients.filter((c) => c.segment === 'at_risk' || c.segment === 'churned').length,
    }
  }, [reservations, clients])

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    window.open(`https://wa.me/52${cleaned}?text=Hola, soy de PET Ap 🐾`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>CRM de Clientes</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {stats.totalClients} clientes · {stats.vipClients} VIP · {stats.atRiskClients} en riesgo
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.totalClients, icon: FaUsers, color: '#D97706' },
          { label: 'Recurrentes', value: stats.repeatClients, icon: FaUserFriends, color: '#059669' },
          { label: 'Activos mes', value: stats.activeClients, icon: FaCalendarAlt, color: '#3b82f6' },
          { label: 'VIP', value: stats.vipClients, icon: FaCrown, color: '#F59E0B' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <s.icon size={14} style={{ color: s.color }} className="mb-2" />
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o mascota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {(['all', 'vip', 'regular', 'new', 'at_risk', 'churned'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSegmentFilter(s)}
              className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-all ${
                segmentFilter === s ? 'bg-brand-500/15 text-brand-400' : 'bg-white/[0.04] text-white/40 hover:text-white/60'
              }`}
            >
              {s === 'all' ? 'Todos' : SEGMENT_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Client list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FaUsers className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {searchQuery || segmentFilter !== 'all' ? 'Sin resultados' : 'No hay clientes aún'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const seg = SEGMENT_CONFIG[c.segment]
            const SegIcon = seg.icon
            return (
              <motion.div
                key={c.phone}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 transition-all hover:bg-white/[0.02] cursor-pointer"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                onClick={() => setSelectedClient(selectedClient?.phone === c.phone ? null : c)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                      <span className={`text-2xs px-2 py-0.5 rounded-full font-medium ${seg.color}`}>
                        <SegIcon size={8} className="inline mr-1" />
                        {seg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>📞 {c.phone}</span>
                      <span>🐾 {c.petNames.join(', ')}</span>
                      <span>📋 {c.reservations.length} reservas</span>
                      <span>💰 ${c.ltv.toLocaleString()}</span>
                      <span>📅 {relativeTime(c.lastVisit)}</span>
                    </div>
                    {c.avgFrequency > 0 && (
                      <p className="text-2xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Promedio cada {c.avgFrequency} días
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openWhatsApp(c.phone) }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-success-500/10 text-success-400"
                      title="WhatsApp"
                    >
                      <FaWhatsapp size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Client Detail Modal */}
      <AnimatePresence>
        {selectedClient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSelectedClient(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{selectedClient.name}</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📞 {selectedClient.phone}</p>
                </div>
                <button onClick={() => setSelectedClient(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                  <FaTimes size={14} />
                </button>
              </div>

              {/* Client KPIs */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'LTV', value: `$${selectedClient.ltv.toLocaleString()}` },
                  { label: 'Reservas', value: String(selectedClient.reservations.length) },
                  { label: 'Frecuencia', value: selectedClient.avgFrequency > 0 ? `${selectedClient.avgFrequency}d` : 'N/A' },
                  { label: 'Mascotas', value: String(selectedClient.petNames.length) },
                ].map((kpi) => (
                  <div key={kpi.label} className="text-center rounded-xl py-3" style={{ background: 'var(--glass-bg)' }}>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* Pet names */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Mascotas</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedClient.petNames.map((p) => (
                    <span key={p} className="text-2xs px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400">
                      🐾 {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Reservation history */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Historial de reservas</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {[...selectedClient.reservations].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs py-2 px-3 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'completed' ? 'bg-success-500' : r.status === 'cancelled' ? 'bg-danger-500' : 'bg-brand-500'}`} />
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.service}</p>
                          <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{r.date} · {r.petName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.paymentStatus === 'paid' && <Badge variant="success" className="text-2xs">Pagado</Badge>}
                        {r.assignedWalker && <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>🦮 {r.assignedWalker}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* WhatsApp */}
              <button
                onClick={() => openWhatsApp(selectedClient.phone)}
                className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all bg-success-500/10 text-success-400 hover:bg-success-500/20"
              >
                <FaWhatsapp size={14} /> Contactar por WhatsApp
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
