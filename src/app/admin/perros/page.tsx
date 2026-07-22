'use client'

import { useState, useMemo } from 'react'
import { useReservations } from '@/context/ReservationsContext'
import { FaSearch, FaPaw, FaDog, FaCalendarAlt, FaUser } from 'react-icons/fa'
import type { Reservation } from '@/types'

interface PetProfile {
  name: string
  ownerName: string
  ownerPhone: string
  type: string
  reservations: Reservation[]
  totalVisits: number
  lastVisit: string
  services: string[]
}

export default function AdminPerrosPage() {
  const { reservations, loading } = useReservations()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPet, setSelectedPet] = useState<PetProfile | null>(null)

  const pets = useMemo(() => {
    const map = new Map<string, PetProfile>()
    reservations.forEach((r) => {
      const key = `${r.phone}__${r.petName}`
      if (!map.has(key)) {
        map.set(key, {
          name: r.petName,
          ownerName: r.name,
          ownerPhone: r.phone,
          type: r.petType || 'Perro',
          reservations: [],
          totalVisits: 0,
          lastVisit: r.date,
          services: [],
        })
      }
      const p = map.get(key)!
      p.reservations.push(r)
      p.totalVisits++
      if (r.date > p.lastVisit) p.lastVisit = r.date
      if (!p.services.includes(r.service)) p.services.push(r.service)
    })
    return Array.from(map.values()).sort((a, b) => b.totalVisits - a.totalVisits)
  }, [reservations])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return pets
    const q = searchQuery.toLowerCase()
    return pets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q) ||
        p.ownerPhone.includes(q) ||
        p.type.toLowerCase().includes(q)
    )
  }, [pets, searchQuery])

  const stats = useMemo(() => {
    const uniquePets = new Set(reservations.map((r) => `${r.phone}__${r.petName}`))
    return {
      totalPets: uniquePets.size,
      totalReservations: reservations.length,
      avgVisits: uniquePets.size > 0 ? (reservations.length / uniquePets.size).toFixed(1) : '0',
    }
  }, [reservations])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Gestión de Perros</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {stats.totalPets} perros registrados · {stats.totalReservations} reservas totales · Promedio {stats.avgVisits} visitas/perro
        </p>
      </div>

      <div className="relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar por nombre de perro, dueño o teléfono..."
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
          <FaPaw className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {searchQuery ? 'Sin resultados' : 'No hay perros registrados aún'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <div
              key={`${p.ownerPhone}__${p.name}`}
              className="rounded-xl p-4 transition-all hover:bg-white/[0.02] cursor-pointer"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={() => setSelectedPet(selectedPet?.name === p.name && selectedPet?.ownerPhone === p.ownerPhone ? null : p)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--bg-elevated)' }}>
                  <FaDog size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                      {p.type}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>👤 {p.ownerName}</span>
                    <span>📋 {p.totalVisits} visitas</span>
                    <span>📅 {p.lastVisit}</span>
                  </div>
                  {p.services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.services.map((s) => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedPet?.name === p.name && selectedPet?.ownerPhone === p.ownerPhone && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Historial de paseos</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {p.reservations.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'completed' ? 'bg-success-500' : r.status === 'en_camino' ? 'bg-blue-500' : 'bg-brand-500'}`} />
                          <span style={{ color: 'var(--text-muted)' }}>{r.date} {r.time}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{r.service}</span>
                        </div>
                        {r.paymentStatus === 'paid' && <span className="text-success-400 text-[10px]">✓ Pagado</span>}
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
