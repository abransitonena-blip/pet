'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion } from 'framer-motion'
import {
  FaCalendarAlt, FaUsers, FaPaw, FaStar,
  FaDog, FaClock, FaWhatsapp, FaWalking,
  FaChartLine, FaTag, FaCog, FaUserFriends,
  FaDollarSign,
} from 'react-icons/fa'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import type { Reservation } from '@/types'

interface Stats {
  todayReservations: number
  weekReservations: number
  monthReservations: number
  pendingReservations: number
  totalRevenue: number
  totalClients: number
  completedToday: number
}

interface WalkerPerf {
  name: string
  assigned: number
  completed: number
  inProgress: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    todayReservations: 0,
    weekReservations: 0,
    monthReservations: 0,
    pendingReservations: 0,
    totalRevenue: 0,
    totalClients: 0,
    completedToday: 0,
  })
  const [upcomingReservations, setUpcomingReservations] = useState<Reservation[]>([])
  const [walkerStats, setWalkerStats] = useState<WalkerPerf[]>([])
  const [loading, setLoading] = useState(true)

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayDate = new Date()
    const weekStart = new Date(todayDate)
    weekStart.setDate(todayDate.getDate() - todayDate.getDay())
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    const todayQ = query(
      collection(db, 'reservations'),
      where('date', '==', today),
      where('status', 'in', ['pending', 'en_camino', 'paseando'])
    )
    const unsubToday = onSnapshot(todayQ, (snap) => {
      setStats((prev) => ({ ...prev, todayReservations: snap.size }))
      setLoading(false)
    })

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

    const weekQ = query(
      collection(db, 'reservations'),
      where('date', '>=', weekStartStr),
      where('date', '<=', today),
    )
    const unsubWeek = onSnapshot(weekQ, (snap) => {
      setStats((prev) => ({ ...prev, weekReservations: snap.size }))
    })

    const monthQ = query(
      collection(db, 'reservations'),
      where('date', '>=', monthStartStr),
      where('date', '<=', today),
    )
    const unsubMonth = onSnapshot(monthQ, (snap) => {
      const docs = snap.docs.map((d) => d.data())
      const revenue = docs.reduce((sum, d) => sum + (d.finalPrice || 0), 0)
      const completed = docs.filter((d) => d.status === 'completed').length
      setStats((prev) => ({ ...prev, monthReservations: snap.size, totalRevenue: revenue, completedToday: completed }))
    })

    const clientsQ = query(collection(db, 'clients'))
    const unsubClients = onSnapshot(clientsQ, (snap) => {
      setStats((prev) => ({ ...prev, totalClients: snap.size }))
    })

    // Walker performance from today's reservations
    const allTodayQ = query(collection(db, 'reservations'), where('date', '==', today))
    const unsubWalkers = onSnapshot(allTodayQ, (snap) => {
      const walkerMap = new Map<string, WalkerPerf>()
      snap.docs.forEach((d) => {
        const data = d.data()
        const walker = data.assignedWalker
        if (!walker) return
        if (!walkerMap.has(walker)) {
          walkerMap.set(walker, { name: walker, assigned: 0, completed: 0, inProgress: 0 })
        }
        const w = walkerMap.get(walker)!
        w.assigned++
        if (data.status === 'completed') w.completed++
        if (data.status === 'paseando' || data.status === 'en_camino') w.inProgress++
      })
      setWalkerStats(Array.from(walkerMap.values()))
    })

    return () => {
      unsubToday()
      unsubPending()
      unsubWeek()
      unsubMonth()
      unsubClients()
      unsubWalkers()
    }
  }, [])

  const statCards = [
    { label: 'Paseos hoy', value: stats.todayReservations, icon: FaCalendarAlt, color: '#D97706' },
    { label: 'Pendientes', value: stats.pendingReservations, icon: FaClock, color: '#3b82f6' },
    { label: 'Reservas del mes', value: stats.monthReservations, icon: FaDog, color: '#059669' },
    { label: 'Ingresos del mes', value: stats.totalRevenue > 0 ? `$${stats.totalRevenue.toLocaleString()}` : '—', icon: FaDollarSign, color: '#7C3AED' },
  ]

  const quickActions = [
    { label: 'Reservas', icon: FaCalendarAlt, href: '/admin/reservas', color: '#D97706' },
    { label: 'Paseadores', icon: FaWalking, href: '/admin/paseadores', color: '#059669' },
    { label: 'Finanzas', icon: FaChartLine, href: '/admin/finanzas', color: '#7C3AED' },
    { label: 'Cupones', icon: FaTag, href: '/admin/cupones', color: '#EC4899' },
    { label: 'Referidos', icon: FaUserFriends, href: '/admin/referidos', color: '#3b82f6' },
    { label: 'Config', icon: FaCog, href: '/admin/config', color: '#64748B' },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 sm:p-6 relative overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {greeting} 👋
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {stats.todayReservations > 0
              ? `${stats.todayReservations} paseo${stats.todayReservations !== 1 ? 's' : ''} programado${stats.todayReservations !== 1 ? 's' : ''} para hoy`
              : 'Sin paseos programados para hoy'
            }
            {stats.pendingReservations > 0 && ` · ${stats.pendingReservations} pendiente${stats.pendingReservations !== 1 ? 's' : ''}`}
          </p>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <StatCard
                label={stat.label}
                value={loading ? '—' : stat.value}
                icon={<Icon size={18} />}
                color={stat.color}
              />
            </motion.div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Accesos rápidos</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <a
                key={action.label}
                href={action.href}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:bg-white/[0.03] hover:scale-[1.03]"
                style={{ border: '1px solid var(--border)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${action.color}15` }}>
                  <Icon size={16} style={{ color: action.color }} />
                </div>
                <span className="text-2xs font-medium" style={{ color: 'var(--text-secondary)' }}>{action.label}</span>
              </a>
            )
          })}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming reservations */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
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
                <div key={i} className="skeleton h-14 rounded-xl" />
              ))}
            </div>
          ) : upcomingReservations.length === 0 ? (
            <div className="text-center py-6">
              <FaDog className="text-2xl mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No hay paseos pendientes</p>
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
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {res.service} · {res.time || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="brand" className="normal-case tracking-normal">Pendiente</Badge>
                    {res.phone && (
                      <a
                        href={`https://wa.me/521${res.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-success-400 hover:bg-success-500/10 transition-colors"
                      >
                        <FaWhatsapp size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Walker Performance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Rendimiento paseadores
            </h3>
            <a href="/admin/paseadores" className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors">
              Ver todos →
            </a>
          </div>

          {walkerStats.length === 0 ? (
            <div className="text-center py-6">
              <FaWalking className="text-2xl mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin paseadores asignados hoy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {walkerStats.map((w) => (
                <div
                  key={w.name}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-success-500/10">
                      <FaWalking size={14} className="text-success-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{w.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {w.assigned} asignado{w.assigned !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.inProgress > 0 && (
                      <span className="text-2xs px-2 py-0.5 rounded-full bg-success-500/15 text-success-400 font-medium">
                        🟢 {w.inProgress} activo{w.inProgress !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-2xs px-2 py-0.5 rounded-full bg-white/10 font-medium" style={{ color: 'var(--text-muted)' }}>
                      ✓ {w.completed}/{w.assigned}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
