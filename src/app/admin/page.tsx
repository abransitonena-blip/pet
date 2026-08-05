'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion } from 'framer-motion'
import { CalendarDays,
  Dog, Clock, PersonStanding,
  ChartLine, Tag, Settings, UserPlus,
  DollarSign } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import AdminWalkerStatus from '@/components/AdminWalkerStatus'
import DataCard from '@/components/ui/DataCard'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import type { Reservation } from '@/types'

interface Stats {
  todayReservations: number
  pendingReservations: number
  monthReservations: number
  totalRevenue: number
  totalClients: number
  completedToday: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    todayReservations: 0,
    monthReservations: 0,
    pendingReservations: 0,
    totalRevenue: 0,
    totalClients: 0,
    completedToday: 0,
  })
  const [upcomingReservations, setUpcomingReservations] = useState<Reservation[]>([])
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
    const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    // Single listener for ALL month's reservations — derives today, week, pending, walker stats
    const monthQ = query(
      collection(db, 'reservations'),
      where('date', '>=', monthStartStr),
      where('date', '<=', today),
    )
    const unsubMonth = onSnapshot(monthQ, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation))
      const todayDocs = docs.filter((d) => d.date === today)
      const pendingDocs = docs.filter((d) => d.status === 'pending').sort((a, b) => (a.date > b.date ? 1 : -1))
      const revenue = docs.reduce((sum, d) => sum + (d.finalPrice || 0), 0)
      const completed = docs.filter((d) => d.status === 'completed').length

      setStats((prev) => ({
        ...prev,
        todayReservations: todayDocs.filter((d) => ['pending', 'on_the_way', 'in_progress'].includes(d.status)).length,
        pendingReservations: pendingDocs.length,
        monthReservations: snap.size,
        totalRevenue: revenue,
        completedToday: completed,
      }))
      setUpcomingReservations(pendingDocs.slice(0, 10))
      setLoading(false)
    })

    // One-shot clients count (no real-time needed for a counter)
    getDocs(query(collection(db, 'customerProfiles'))).then((snap) => {
      setStats((prev) => ({ ...prev, totalClients: snap.size }))
    }).catch(() => {})

    return unsubMonth
  }, [])

  const statCards = [
    { label: 'Paseos hoy', value: stats.todayReservations, icon: CalendarDays, color: '#D97706' },
    { label: 'Pendientes', value: stats.pendingReservations, icon: Clock, color: '#3b82f6' },
    { label: 'Reservas del mes', value: stats.monthReservations, icon: Dog, color: '#059669' },
    { label: 'Ingresos del mes', value: stats.totalRevenue > 0 ? `$${stats.totalRevenue.toLocaleString()}` : '—', icon: DollarSign, color: '#7C3AED' },
  ]

  const quickActions = [
    { label: 'Reservas', icon: CalendarDays, href: '/admin/reservas', color: '#D97706' },
    { label: 'Paseadores', icon: PersonStanding, href: '/admin/paseadores', color: '#059669' },
    { label: 'Finanzas', icon: ChartLine, href: '/admin/finanzas', color: '#7C3AED' },
    { label: 'Cupones', icon: Tag, href: '/admin/cupones', color: '#EC4899' },
    { label: 'Referidos', icon: UserPlus, href: '/admin/referidos', color: '#3b82f6' },
    { label: 'Config', icon: Settings, href: '/admin/config', color: '#64748B' },
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
              transition={{ duration: 0.22, delay: i * 0.05 }}
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
        transition={{ duration: 0.22, delay: 0.2 }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Accesos rápidos</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <a
                key={action.label}
                href={action.href}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:bg-ink/5 hover:scale-[1.03]"
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
          transition={{ duration: 0.22, delay: 0.25 }}
        >
          <DataCard
            title="Próximos paseos"
            action={
              <Link href="/admin/reservas" className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors">
                Ver todos →
              </Link>
            }
          >
            {loading ? (
              <LoadingState rows={3} height="h-14" />
            ) : upcomingReservations.length === 0 ? (
              <EmptyState
                icon={<Dog size={22} />}
                title="No hay paseos pendientes"
                description="Cuando un cliente solicite un paseo aparecerá aquí."
              />
            ) : (
              <div className="space-y-2">
                {upcomingReservations.slice(0, 5).map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between p-3 rounded-xl transition-colors hover:bg-ink/5"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-500/10">
                        <Dog size={14} className="text-brand-400" />
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
                      <StatusBadge status={res.status} />
                      {res.phone && (
                        <a
                          href={`https://wa.me/521${res.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-success-400 hover:bg-success-500/10 transition-colors"
                        >
                          <WhatsAppIcon width={12} height={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataCard>
        </motion.div>

        {/* Walker Live Status */}
        <AdminWalkerStatus />
      </div>
    </div>
  )
}

import { WhatsAppIcon } from '@/components/ui/SocialIcons'
