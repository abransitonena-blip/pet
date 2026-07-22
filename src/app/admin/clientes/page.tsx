'use client'

import { useState, useMemo } from 'react'
import { useReservations } from '@/context/ReservationsContext'
import { FaSearch, FaUsers, FaWhatsapp, FaDog, FaCalendarAlt, FaMoneyBill } from 'react-icons/fa'
import { getServicePrice } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import type { Reservation } from '@/types'

interface Client {
  name: string
  phone: string
  reservations: Reservation[]
  petNames: string[]
  totalSpent: number
  lastVisit: string
}

export default function AdminClientesPage() {
  const { reservations, loading } = useReservations()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const { prices } = usePrices()

  const clients = useMemo(() => {
    const map = new Map<string, Client>()
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
        })
      }
      const c = map.get(key)!
      c.reservations.push(r)
      if (!c.petNames.includes(r.petName)) c.petNames.push(r.petName)
      if (r.paymentStatus === 'paid') c.totalSpent += prices[r.service] ?? getServicePrice(r.service)
      if (r.date > c.lastVisit) c.lastVisit = r.date
    })
    return Array.from(map.values()).sort((a, b) => b.reservations.length - a.reservations.length)
  }, [reservations, prices])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return clients
    const q = searchQuery.toLowerCase()
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.petNames.some((p) => p.toLowerCase().includes(q))
    )
  }, [clients, searchQuery])

  const stats = useMemo(() => {
    const uniquePhones = new Set(reservations.map((r) => r.phone))
    const today = new Date().toISOString().split('T')[0]
    return {
      totalClients: uniquePhones.size,
      activeClients: new Set(reservations.filter((r) => r.date >= today.slice(0, 7)).map((r) => r.phone)).size,
      totalReservations: reservations.length,
      repeatClients: Array.from(uniquePhones).filter(
        (p) => reservations.filter((r) => r.phone === p).length > 1
      ).length,
    }
  }, [reservations])

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    window.open(`https://wa.me/52${cleaned}?text=Hola, soy de PET Ap 🐾`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Gestión de Clientes</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {stats.totalClients} clientes · {stats.repeatClients} recurrentes · {stats.activeClients} activos este mes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.totalClients, icon: FaUsers, color: '#D97706' },
          { label: 'Recurrentes', value: stats.repeatClients, icon: FaDog, color: '#059669' },
          { label: 'Activos mes', value: stats.activeClients, icon: FaCalendarAlt, color: '#3b82f6' },
          { label: 'Reservas', value: stats.totalReservations, icon: FaMoneyBill, color: '#7C3AED' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <s.icon size={14} style={{ color: s.color }} className="mb-2" />
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o mascota..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FaUsers className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {searchQuery ? 'Sin resultados' : 'No hay clientes aún'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div
              key={c.phone}
              className="rounded-xl p-4 transition-all hover:bg-white/[0.02] cursor-pointer"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={() => setSelectedClient(selectedClient?.phone === c.phone ? null : c)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                    {c.reservations.length > 1 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-success-500/15 text-success-400 font-medium">
                        Recurrente
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>📞 {c.phone}</span>
                    <span>🐾 {c.petNames.join(', ')}</span>
                    <span>📋 {c.reservations.length} reservas</span>
                    <span>📅 Última: {c.lastVisit}</span>
                  </div>
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

              {selectedClient?.phone === c.phone && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Historial de reservas</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {c.reservations.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'completed' ? 'bg-success-500' : 'bg-brand-500'}`} />
                          <span style={{ color: 'var(--text-muted)' }}>{r.date} {r.time}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{r.service}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'var(--text-muted)' }}>🐾 {r.petName}</span>
                          {r.paymentStatus === 'paid' && <span className="text-success-400">✓</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
