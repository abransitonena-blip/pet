'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion } from 'framer-motion'
import {
  FaCalendarAlt, FaDollarSign, FaUsers, FaPaw, FaStar,
  FaArrowUp, FaArrowDown, FaDog, FaClock, FaWhatsapp,
} from 'react-icons/fa'
import type { Reservation } from '@/types'

interface Stats {
  todayReservations: number
  weekReservations: number
  monthReservations: number
  pendingReservations: number
  totalRevenue: number
  totalClients: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    todayReservations: 0,
    weekReservations: 0,
    monthReservations: 0,
    pendingReservations: 0,
    totalRevenue: 0,
    totalClients: 0,
  })
  const [upcomingReservations, setUpcomingReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]

    // Today's reservations
    const todayQ = query(
      collection(db, 'reservations'),
      where('date', '==', today),
      where('status', 'in', ['pending', 'en_camino', 'paseando'])
    )
    const unsubToday = onSnapshot(todayQ, (snap) => {
      setStats((prev) => ({ ...prev, todayReservations: snap.size }))
      setLoading(false)
    })

    // Pending reservations
    const pendingQ = query(
      collection(db, 'reservations'),
      where('status', '==', 'pending'),
      orderBy('date', 'asc'),
      limit(10)
    )
    const unsubPending = onSnapshot(pendingQ, (snap) => {
      setStats((prev) => ({ ...prev, pendingReservations: snap.size }))
      setUpcomingReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)))
    })

    // Total clients
    const clientsQ = query(collection(db, 'clients'), limit(1))
    const unsubClients = onSnapshot(clientsQ, (snap) => {
      // Note: This is approximate. For exact count, use a counter doc.
      setStats((prev) => ({ ...prev, totalClients: snap.size }))
    })

    return () => {
      unsubToday()
      unsubPending()
      unsubClients()
    }
  }, [])

  const statCards = [
    { label: 'Paseos hoy', value: stats.todayReservations, icon: FaCalendarAlt, color: '#D97706' },
    { label: 'Pendientes', value: stats.pendingReservations, icon: FaClock, color: '#3b82f6' },
    { label: 'Total reservas', value: stats.monthReservations, icon: FaDog, color: '#059669' },
    { label: 'Clientes', value: stats.totalClients, icon: FaUsers, color: '#7C3AED' },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Buenos días 👋
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Aquí tienes el resumen del día
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15`, color: stat.color }}>
                  <Icon size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {loading ? '—' : stat.value}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Upcoming reservations */}
      <div className="rounded-2xl p-5 sm:p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Próximos paseos
          </h3>
          <a href="/admin/reservas" className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors">
            Ver todos →
          </a>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : upcomingReservations.length === 0 ? (
          <div className="text-center py-8">
            <FaDog className="text-3xl mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay paseos pendientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingReservations.slice(0, 5).map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between p-3 rounded-xl transition-colors hover:bg-white/[0.02]"
                style={{ border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-500/10">
                    <FaDog size={14} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {res.petName || 'Sin nombre'}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {res.service} · {res.time || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-medium">
                    {res.status === 'pending' ? 'Pendiente' : res.status}
                  </span>
                  <a
                    href={`https://wa.me/521${res.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-success-400 hover:bg-success-500/10 transition-colors"
                    aria-label={`WhatsApp con ${res.name}`}
                  >
                    <FaWhatsapp size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
