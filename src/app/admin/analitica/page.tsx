'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/firebase/config'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { FaChartLine, FaCalendarAlt, FaDog, FaUsers, FaStar } from 'react-icons/fa'
import { getServicePrice } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import { useReservations } from '@/context/ReservationsContext'
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

  useEffect(() => {
    const q2 = query(collection(db, 'reviews'), orderBy('date', 'desc'))
    const unsub2 = onSnapshot(q2, (snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review)))
    })
    return () => { unsub2() }
  }, [])

  const getEffectivePrice = (serviceName: string) => prices[serviceName] ?? getServicePrice(serviceName)

  const analytics = useMemo(() => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0]
    const monthAgo = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0]
    const lastMonth = new Date(today.getTime() - 60 * 86400000).toISOString().split('T')[0]

    const thisMonth = reservations.filter((r) => r.date >= monthAgo)
    const prevMonth = reservations.filter((r) => r.date >= lastMonth && r.date < monthAgo)

    const completedThisMonth = thisMonth.filter((r) => r.status === 'completed')
    const completedPrevMonth = prevMonth.filter((r) => r.status === 'completed')

    const revenueThisMonth = completedThisMonth.reduce((sum, r) => sum + getEffectivePrice(r.service), 0)
    const revenuePrevMonth = completedPrevMonth.reduce((sum, r) => sum + getEffectivePrice(r.service), 0)

    const uniqueClientsThisMonth = new Set(thisMonth.map((r) => r.phone)).size
    const uniqueClientsPrevMonth = new Set(prevMonth.map((r) => r.phone)).size

    const repeatClients = new Map<string, number>()
    reservations.forEach((r) => {
      repeatClients.set(r.phone, (repeatClients.get(r.phone) || 0) + 1)
    })
    const returningClients = Array.from(repeatClients.values()).filter((c) => c > 1).length
    const totalClients = repeatClients.size

    const serviceCounts: Record<string, number> = {}
    reservations.forEach((r) => {
      serviceCounts[r.service] = (serviceCounts[r.service] || 0) + 1
    })
    const topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const dayOfWeekCounts: Record<string, number> = {
      'Lun': 0, 'Mar': 0, 'Mié': 0, 'Jue': 0, 'Vie': 0, 'Sáb': 0, 'Dom': 0,
    }
    const dayMap = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    reservations.forEach((r) => {
      const d = new Date(r.date + 'T12:00:00')
      const dayName = dayMap[d.getDay()]
      if (dayOfWeekCounts[dayName] !== undefined) dayOfWeekCounts[dayName]++
    })

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
      dayOfWeekCounts,
      avgRating,
      totalReviews: reviews.length,
    }
  }, [reservations, reviews, getEffectivePrice])

  const maxDayCount = Math.max(...Object.values(analytics.dayOfWeekCounts), 1)

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
              { label: 'Reservas este mes', value: analytics.thisMonthReservations, trend: `+${analytics.growthRevenue}%`, trendUp: analytics.growthRevenue > 0, color: '#D97706' },
              { label: 'Ingresos este mes', value: `$${analytics.revenueThisMonth.toLocaleString()}`, trend: `+${analytics.growthRevenue}%`, trendUp: analytics.growthRevenue > 0, color: '#059669' },
              { label: 'Clientes nuevos', value: analytics.uniqueClientsThisMonth, trend: `+${analytics.growthClients}%`, trendUp: analytics.growthClients > 0, color: '#3b82f6' },
              { label: 'Calificación', value: `${analytics.avgRating} ★`, trend: `${analytics.totalReviews} reseñas`, trendUp: true, color: '#7C3AED' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <p className="text-2xs mb-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
                <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className={`text-2xs mt-0.5 ${kpi.trendUp ? 'text-success-400' : 'text-danger-400'}`}>
                  {kpi.trend}
                </p>
              </div>
            ))}
          </div>

          {/* Retention */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Retención de clientes</p>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-full rounded-full bg-success-500"
                    style={{ width: `${analytics.totalClients > 0 ? (analytics.returningClients / analytics.totalClients) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {analytics.totalClients > 0 ? Math.round((analytics.returningClients / analytics.totalClients) * 100) : 0}%
              </span>
            </div>
            <p className="text-2xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {analytics.returningClients} de {analytics.totalClients} clientes han repetido
            </p>
          </div>

          {/* Top services + Day of week */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Servicios más populares</p>
              <div className="space-y-2">
                {analytics.topServices.map(([service, count], i) => (
                  <div key={service}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span style={{ color: 'var(--text-secondary)' }}>{service}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{count}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div
                        className="h-full rounded-full bg-brand-500/50"
                        style={{ width: `${(count / analytics.topServices[0][1]) * 100}%` }}
                      />
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
                    <div
                      className="w-full rounded-t bg-blue-500/50 min-h-[2px]"
                      style={{ height: `${(count / maxDayCount) * 100}%` }}
                    />
                    <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
