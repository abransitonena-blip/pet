'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Bot, CalendarDays, Dog, Users, ChartLine, Clock,
  Lightbulb, ArrowUp, ArrowDown, AlertTriangle,
  Zap, Star, PersonStanding, Banknote, ArrowRight, Percent,
} from 'lucide-react'
import { getServicePrice } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import { useReservations } from '@/context/ReservationsContext'
import { useConfig } from '@/context/ConfigContext'
import type { Reservation } from '@/types'

interface Insight {
  id: string
  title: string
  description: string
  icon: typeof Bot
  color: string
  priority: 'high' | 'medium' | 'low'
  action?: string
}

export default function AdminIAPage() {
  const { reservations, loading } = useReservations()
  const { prices } = usePrices()
  const { config } = useConfig()
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  const getEffectivePrice = (serviceName: string) => prices[serviceName] ?? getServicePrice(serviceName)

  const insights = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const periodDays = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90
    const periodStart = new Date(now.getTime() - periodDays * 86400000).toISOString().split('T')[0]
    const prevStart = new Date(now.getTime() - periodDays * 2 * 86400000).toISOString().split('T')[0]

    const periodRes = reservations.filter((r) => r.date >= periodStart)
    const prevRes = reservations.filter((r) => r.date >= prevStart && r.date < periodStart)
    const completed = periodRes.filter((r) => r.status === 'completed')
    const prevCompleted = prevRes.filter((r) => r.status === 'completed')

    // Revenue
    const revenue = completed.reduce((s, r) => s + getEffectivePrice(r.service), 0)
    const prevRevenue = prevCompleted.reduce((s, r) => s + getEffectivePrice(r.service), 0)
    const revenueGrowth = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0

    // Peak day
    const dayCounts: Record<string, number> = { 'Dom': 0, 'Lun': 0, 'Mar': 0, 'Mié': 0, 'Jue': 0, 'Vie': 0, 'Sáb': 0 }
    const dayMap = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    periodRes.forEach((r) => {
      const d = new Date(r.date + 'T12:00:00')
      dayCounts[dayMap[d.getDay()]]++
    })
    const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]

    // Peak hour
    const hourCounts: Record<number, number> = {}
    periodRes.forEach((r) => {
      const hour = parseInt((r.arrivalWindowStart || r.time || '12').split(':')[0])
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]

    // Service popularity
    const serviceCounts: Record<string, number> = {}
    periodRes.forEach((r) => { serviceCounts[r.service] = (serviceCounts[r.service] || 0) + 1 })
    const topService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]

    // Client retention
    const phoneCounts = new Map<string, number>()
    reservations.forEach((r) => phoneCounts.set(r.phone, (phoneCounts.get(r.phone) || 0) + 1))
    const totalClients = phoneCounts.size
    const returningClients = Array.from(phoneCounts.values()).filter((c) => c > 1).length
    const retentionRate = totalClients > 0 ? Math.round((returningClients / totalClients) * 100) : 0

    // Pending alerts
    const pending = reservations.filter((r) => r.status === 'pending')
    const pendingToday = pending.filter((r) => r.date === todayStr)

    // Walker load
    const walkers = (config.walkers || []) as { name: string; uid?: string }[]
    const walkerLoads = walkers.map((w) => {
      const assigned = reservations.filter((r) => 
        (r.assignedWalker === w.name || r.assignment?.walkerId === w.uid) && 
        r.date === todayStr
      )
      return { name: w.name, today: assigned.length, pending: assigned.filter((r) => r.status === 'pending').length }
    })
    const overloaded = walkerLoads.filter((w) => w.today > 6)

    // Avg daily
    const uniqueDays = new Set(periodRes.map((r) => r.date)).size
    const avgDaily = uniqueDays > 0 ? (periodRes.length / uniqueDays).toFixed(1) : '0'

    // Cancellation rate
    const cancelled = periodRes.filter((r) => r.status === 'cancelled').length
    const cancelRate = periodRes.length > 0 ? Math.round((cancelled / periodRes.length) * 100) : 0

    // Generate insights
    const result: Insight[] = []

    // Revenue insight
    if (revenueGrowth > 10) {
      result.push({ id: 'rev_up', title: 'Ingresos en alza', description: `Los ingresos subieron ${revenueGrowth}% vs el periodo anterior. Tendencia positiva.`, icon: ArrowUp, color: '#059669', priority: 'high' })
    } else if (revenueGrowth < -10) {
      result.push({ id: 'rev_down', title: 'Ingresos bajando', description: `Los ingresos bajaron ${Math.abs(revenueGrowth)}%. Considera promociones para reactivar.`, icon: ArrowDown, color: '#DC2626', priority: 'high', action: 'Crear cupón de descuento' })
    }

    // Pending alerts
    if (pendingToday.length > 0) {
      result.push({ id: 'pending', title: `${pendingToday.length} reserva${pendingToday.length !== 1 ? 's' : ''} pendiente${pendingToday.length !== 1 ? 's' : ''} hoy`, description: 'Reservas sin asignar o confirmar para hoy. Asigna paseadores o confirma con el cliente.', icon: AlertTriangle, color: '#F59E0B', priority: 'high', action: 'Ir a reservas' })
    }

    // Peak day
    if (peakDay && peakDay[1] > 0) {
      result.push({ id: 'peak_day', title: `Día más demandado: ${peakDay[0]}`, description: `El ${peakDay[0]} concentra ${peakDay[1]} reservas del periodo. Asegúrate de tener paseadores disponibles.`, icon: CalendarDays, color: '#3b82f6', priority: 'medium' })
    }

    // Peak hour
    if (peakHour) {
      result.push({ id: 'peak_hour', title: `Hora pico: ${peakHour[0]}:00`, description: `La mayoría de reservas son a las ${peakHour[0]}:00. Considera bloquear paseadores en ese horario.`, icon: Clock, color: '#8B5CF6', priority: 'medium' })
    }

    // Retention
    if (retentionRate < 30 && totalClients > 5) {
      result.push({ id: 'low_retention', title: 'Retención baja', description: `Solo ${retentionRate}% de tus clientes repiten. Usa el sistema de lealtad y referidos para mejorar.`, icon: Users, color: '#F59E0B', priority: 'high', action: 'Revisar lealtad' })
    } else if (retentionRate > 50) {
      result.push({ id: 'good_retention', title: 'Buena retención', description: `${retentionRate}% de tus clientes son recurrentes. ¡Excelente relación con ellos!`, icon: Star, color: '#059669', priority: 'low' })
    }

    // Top service
    if (topService) {
      const pct = periodRes.length > 0 ? Math.round((topService[1] / periodRes.length) * 100) : 0
      result.push({ id: 'top_service', title: `Servicio estrella: ${topService[0]}`, description: `Representa el ${pct}% de las reservas. Podrías destacarlo en tu página.`, icon: Zap, color: '#D97706', priority: 'medium' })
    }

    // Overloaded walkers
    if (overloaded.length > 0) {
      result.push({ id: 'overloaded', title: 'Paseadores sobrecargados', description: `${overloaded.map((w) => w.name).join(', ')} tienen más de 6 reservas hoy. Considera redistribuir.`, icon: PersonStanding, color: '#DC2626', priority: 'high' })
    }

    // Cancel rate
    if (cancelRate > 15) {
      result.push({ id: 'high_cancel', title: `${cancelRate}% de cancelaciones`, description: 'Tasa de cancelación alta. Revisa si hay patrones (servicio, horario, zona).', icon: AlertTriangle, color: '#F59E0B', priority: 'medium' })
    }

    return result.sort((a, b) => {
      const prio = { high: 0, medium: 1, low: 2 }
      return prio[a.priority] - prio[b.priority]
    })
  }, [reservations, config.walkers, selectedPeriod, getEffectivePrice])

  // Service margin analysis
  const serviceMargins = useMemo(() => {
    const now = new Date()
    const periodDays = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90
    const periodStart = new Date(now.getTime() - periodDays * 86400000).toISOString().split('T')[0]
    const periodRes = reservations.filter((r) => r.date >= periodStart && r.status === 'completed')

    const services: Record<string, { count: number; revenue: number; discounts: number }> = {}
    periodRes.forEach((r) => {
      const price = getEffectivePrice(r.service)
      const discount = r.discountApplied || 0
      if (!services[r.service]) services[r.service] = { count: 0, revenue: 0, discounts: 0 }
      services[r.service].count++
      services[r.service].revenue += price
      services[r.service].discounts += discount
    })

    return Object.entries(services)
      .map(([name, data]) => ({
        name,
        count: data.count,
        revenue: data.revenue,
        discounts: data.discounts,
        avgPrice: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
        discountRate: data.revenue > 0 ? Math.round((data.discounts / (data.revenue + data.discounts)) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [reservations, selectedPeriod, getEffectivePrice])

  const metrics = useMemo(() => {
    const now = new Date()
    const periodDays = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90
    const periodStart = new Date(now.getTime() - periodDays * 86400000).toISOString().split('T')[0]
    const periodRes = reservations.filter((r) => r.date >= periodStart)
    const completed = periodRes.filter((r) => r.status === 'completed')
    const revenue = completed.reduce((s, r) => s + getEffectivePrice(r.service), 0)
    const uniqueDays = new Set(periodRes.map((r) => r.date)).size

    return {
      totalRes: periodRes.length,
      completed: completed.length,
      revenue,
      avgDaily: uniqueDays > 0 ? (periodRes.length / uniqueDays).toFixed(1) : '0',
      cancelRate: periodRes.length > 0 ? Math.round((periodRes.filter((r) => r.status === 'cancelled').length / periodRes.length) * 100) : 0,
    }
  }, [reservations, selectedPeriod, getEffectivePrice])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Bot size={20} className="text-brand-600" />
            Centro de Insights
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Análisis inteligente basado en tus datos
          </p>
        </div>
        <div className="flex gap-1.5">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button key={p} onClick={() => setSelectedPeriod(p)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${selectedPeriod === p ? 'bg-brand-500/15 text-brand-600' : 'bg-ink/5 text-muted hover:text-primary'}`}>
              {p === '7d' ? '7 días' : p === '30d' ? '30 días' : '90 días'}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Reservas', value: metrics.totalRes, icon: CalendarDays, color: '#D97706' },
          { label: 'Completadas', value: metrics.completed, icon: Dog, color: '#059669' },
          { label: 'Ingresos', value: `$${metrics.revenue.toLocaleString()}`, icon: Banknote, color: '#3b82f6' },
          { label: 'Cancelaciones', value: `${metrics.cancelRate}%`, icon: AlertTriangle, color: metrics.cancelRate > 15 ? '#DC2626' : '#059669' },
        ].map((m) => (
          <div key={m.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <m.icon size={14} style={{ color: m.color }} className="mb-2" />
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{m.value}</p>
            <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={14} className="text-warning-400" />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Insights</h3>
          <span className="text-2xs px-2 py-0.5 rounded-full" style={{ background: 'var(--glass-bg)', color: 'var(--text-muted)' }}>
            {insights.length}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        ) : insights.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <Bot className="text-3xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay insights para este periodo</p>
          </div>
        ) : (
          <div className="space-y-2">
            {insights.map((insight, i) => {
              const Icon = insight.icon
              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl p-4 flex items-start gap-3"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${insight.color}15` }}>
                    <Icon size={16} style={{ color: insight.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{insight.title}</p>
                      {insight.priority === 'high' && (
                        <span className="text-2xs px-1.5 py-0.5 rounded-full bg-danger-500/15 text-red-700 font-medium">Urgente</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{insight.description}</p>
                    {insight.action && (
                      <button className="text-2xs font-medium mt-2 flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: 'var(--color-primary)' }}>
                        {insight.action} <ArrowRight size={8} />
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Service Margin Analysis */}
      {serviceMargins.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center gap-2 mb-3">
            <Percent size={14} className="text-brand-600" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Análisis de margen por servicio</h3>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-5 gap-2 px-4 py-2 text-2xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              <span className="col-span-2">Servicio</span>
              <span className="text-right">Paseos</span>
              <span className="text-right">Ingresos</span>
              <span className="text-right">Descuento %</span>
            </div>
            {serviceMargins.map((s) => (
              <div key={s.name} className="grid grid-cols-5 gap-2 px-4 py-3 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="col-span-2 font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                <span className="text-right" style={{ color: 'var(--text-secondary)' }}>{s.count}</span>
                <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>${s.revenue.toLocaleString()}</span>
                <span className={`text-right font-medium ${s.discountRate > 20 ? 'text-red-700' : s.discountRate > 10 ? 'text-amber-700' : 'text-success-600'}`}>
                  {s.discountRate}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
