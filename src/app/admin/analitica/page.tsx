'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/firebase/config'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { CalendarDays, Users, Star, PersonStanding, Banknote } from 'lucide-react'
import { getServicePrice } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import { useReservations } from '@/context/ReservationsContext'
import { useConfig } from '@/context/ConfigContext'
import type { Reservation } from '@/types'

interface Review {
  id: string
  rating: number
  date: string
}

export default function AdminAnaliticaPage() {
  const { reservations, loading } = useReservations()
  const [reviews, setReviews] = useState<Review[]>([])
  const { prices } = usePrices()
  const { config } = useConfig()

  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('date', 'desc'))
    return onSnapshot(q, (snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review)))
    })
  }, [])

  const getEffectivePrice = (serviceName: string) => prices[serviceName] ?? getServicePrice(serviceName)

  const analytics = useMemo(() => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const monthAgo = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0]
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0]
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]

    const thisMonth = reservations.filter((r) => r.date >= monthAgo)
    const prevMonth = reservations.filter((r) => r.date >= lastMonthStart && r.date <= lastMonthEnd)

    const completedThisMonth = thisMonth.filter((r) => r.status === 'completed')
    const completedPrevMonth = prevMonth.filter((r) => r.status === 'completed')

    const revenueThisMonth = completedThisMonth.reduce((sum, r) => sum + getEffectivePrice(r.service), 0)
    const revenuePrevMonth = completedPrevMonth.reduce((sum, r) => sum + getEffectivePrice(r.service), 0)

    const uniqueClientsThisMonth = new Set(thisMonth.map((r) => r.phone)).size
    const uniqueClientsPrevMonth = new Set(prevMonth.map((r) => r.phone)).size

    const repeatClients = new Map<string, number>()
    reservations.forEach((r) => repeatClients.set(r.phone, (repeatClients.get(r.phone) || 0) + 1))
    const returningClients = Array.from(repeatClients.values()).filter((c) => c > 1).length
    const totalClients = repeatClients.size

    // Top services
    const serviceCounts: Record<string, number> = {}
    reservations.forEach((r) => { serviceCounts[r.service] = (serviceCounts[r.service] || 0) + 1 })
    const topServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const maxServiceCount = topServices.length > 0 ? topServices[0][1] : 1

    // Day of week
    const dayOfWeekCounts: Record<string, number> = { 'Lun': 0, 'Mar': 0, 'Mié': 0, 'Jue': 0, 'Vie': 0, 'Sáb': 0, 'Dom': 0 }
    const dayMap = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    reservations.forEach((r) => {
      const d = new Date(r.date + 'T12:00:00')
      const dayName = dayMap[d.getDay()]
      if (dayOfWeekCounts[dayName] !== undefined) dayOfWeekCounts[dayName]++
    })

    // Monthly revenue (last 6 months)
    const monthlyRevenue: { month: string; label: string; revenue: number; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthStr = d.toISOString().slice(0, 7)
      const monthLabel = d.toLocaleDateString('es-MX', { month: 'short' })
      const monthRes = reservations.filter((r) => r.date.startsWith(monthStr) && r.status === 'completed')
      monthlyRevenue.push({
        month: monthStr,
        label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        revenue: monthRes.reduce((sum, r) => sum + getEffectivePrice(r.service), 0),
        count: monthRes.length,
      })
    }
    const maxMonthlyRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1)

    // Walker performance
    const walkers = (config.walkers || []) as { name: string; uid?: string }[]
    const walkerPerformance = walkers.map((w) => {
      const assigned = reservations.filter((r) => 
        r.assignedWalker === w.name || 
        r.assignment?.walkerId === w.uid
      )
      const completed = assigned.filter((r) => r.status === 'completed')
      return {
        name: w.name,
        total: assigned.length,
        completed: completed.length,
        completionRate: assigned.length > 0 ? Math.round((completed.length / assigned.length) * 100) : 0,
        revenue: completed.reduce((sum, r) => sum + getEffectivePrice(r.service), 0),
      }
    }).sort((a, b) => b.completed - a.completed)

    // Service mix
    const serviceRevenue: Record<string, number> = {}
    completedThisMonth.forEach((r) => {
      serviceRevenue[r.service] = (serviceRevenue[r.service] || 0) + getEffectivePrice(r.service)
    })
    const serviceMix = Object.entries(serviceRevenue).sort((a, b) => b[1] - a[1])
    const totalServiceRevenue = serviceMix.reduce((sum, [, v]) => sum + v, 0) || 1

    const avgRating = reviews.length > 0
      ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
      : '0'

    const growthRevenue = revenuePrevMonth > 0
      ? Math.round(((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100)
      : revenueThisMonth > 0 ? 100 : 0

    const growthClients = uniqueClientsPrevMonth > 0
      ? Math.round(((uniqueClientsThisMonth - uniqueClientsPrevMonth) / uniqueClientsPrevMonth) * 100)
      : uniqueClientsThisMonth > 0 ? 100 : 0

    return {
      totalReservations: reservations.length,
      thisMonthReservations: thisMonth.length,
      revenueThisMonth,
      growthRevenue,
      uniqueClientsThisMonth,
      growthClients,
      returningClients,
      totalClients,
      topServices,
      maxServiceCount,
      dayOfWeekCounts,
      monthlyRevenue,
      maxMonthlyRevenue,
      walkerPerformance,
      serviceMix,
      totalServiceRevenue,
      avgRating,
      totalReviews: reviews.length,
    }
  }, [reservations, reviews, config.walkers, getEffectivePrice])

  const maxDayCount = Math.max(...Object.values(analytics.dayOfWeekCounts), 1)

  const SERVICE_COLORS = ['#D97706', '#059669', '#3b82f6', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#6366F1']

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Analítica</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Métricas clave y tendencias del negocio
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Reservas este mes', value: analytics.thisMonthReservations, trend: `${analytics.growthRevenue >= 0 ? '+' : ''}${analytics.growthRevenue}%`, trendUp: analytics.growthRevenue > 0, color: '#D97706', icon: CalendarDays },
              { label: 'Ingresos este mes', value: `$${analytics.revenueThisMonth.toLocaleString()}`, trend: `${analytics.growthRevenue >= 0 ? '+' : ''}${analytics.growthRevenue}%`, trendUp: analytics.growthRevenue > 0, color: '#059669', icon: Banknote },
              { label: 'Clientes nuevos', value: analytics.uniqueClientsThisMonth, trend: `${analytics.growthClients >= 0 ? '+' : ''}${analytics.growthClients}%`, trendUp: analytics.growthClients > 0, color: '#3b82f6', icon: Users },
              { label: 'Calificación', value: `${analytics.avgRating} ★`, trend: `${analytics.totalReviews} reseñas`, trendUp: true, color: '#7C3AED', icon: Star },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <kpi.icon size={14} style={{ color: kpi.color }} className="mb-2" />
                <p className="text-2xs mb-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
                <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className={`text-2xs mt-0.5 ${kpi.trendUp ? 'text-success-400' : 'text-danger-400'}`}>
                  {kpi.trend}
                </p>
              </div>
            ))}
          </div>

          {/* Monthly Revenue Chart */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Ingresos mensuales (6 meses)</p>
            <div className="flex items-end gap-2 h-40">
              {analytics.monthlyRevenue.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-2xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    ${m.revenue > 0 ? m.revenue.toLocaleString() : '0'}
                  </span>
                  <div
                    className="w-full rounded-t transition-all min-h-[2px]"
                    style={{
                      height: `${(m.revenue / analytics.maxMonthlyRevenue) * 100}%`,
                      background: m.month === analytics.monthlyRevenue[analytics.monthlyRevenue.length - 1]?.month
                        ? 'var(--color-success)' : 'var(--color-success)50',
                    }}
                  />
                  <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Retention + Service Mix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Retention */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Retención de clientes</p>
              <div className="flex items-center gap-4 mb-2">
                <div className="flex-1">
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="h-full rounded-full bg-success-500" style={{ width: `${analytics.totalClients > 0 ? (analytics.returningClients / analytics.totalClients) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {analytics.totalClients > 0 ? Math.round((analytics.returningClients / analytics.totalClients) * 100) : 0}%
                </span>
              </div>
              <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                {analytics.returningClients} de {analytics.totalClients} clientes han repetido
              </p>
            </div>

            {/* Service Mix */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Mix de servicios (este mes)</p>
              <div className="space-y-2">
                {analytics.serviceMix.map(([service, revenue], i) => (
                  <div key={service}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: SERVICE_COLORS[i % SERVICE_COLORS.length] }} />
                        {service}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>${revenue.toLocaleString()}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(revenue / analytics.totalServiceRevenue) * 100}%`, background: SERVICE_COLORS[i % SERVICE_COLORS.length] }} />
                    </div>
                  </div>
                ))}
                {analytics.serviceMix.length === 0 && (
                  <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Sin datos este mes</p>
                )}
              </div>
            </div>
          </div>

          {/* Top Services + Day of Week */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Servicios más populares</p>
              <div className="space-y-2">
                {analytics.topServices.map(([service, count]) => (
                  <div key={service}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span style={{ color: 'var(--text-secondary)' }}>{service}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{count}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full bg-brand-500/50" style={{ width: `${(count / analytics.maxServiceCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Reservas por día de la semana</p>
              <div className="flex items-end gap-1 h-32">
                {Object.entries(analytics.dayOfWeekCounts).map(([day, count]) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{count}</span>
                    <div className="w-full rounded-t bg-blue-500/50 min-h-[2px]" style={{ height: `${(count / maxDayCount) * 100}%` }} />
                    <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Walker Performance */}
          {analytics.walkerPerformance.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <PersonStanding size={14} className="text-blue-400" />
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Rendimiento de paseadores</p>
              </div>
              <div className="space-y-3">
                {analytics.walkerPerformance.map((w) => (
                  <div key={w.name} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <PersonStanding size={12} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                        <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                          {w.completed}/{w.total} · ${w.revenue.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${w.completionRate}%` }} />
                      </div>
                      <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{w.completionRate}% completado</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
