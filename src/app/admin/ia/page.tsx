'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FaRobot, FaArrowUp, FaArrowDown, FaLightbulb, FaCalendarAlt,
  FaDog, FaDollarSign, FaClock, FaStar, FaArrowRight, FaBrain,
} from 'react-icons/fa'
import { useReservations } from '@/context/ReservationsContext'
import type { Reservation } from '@/types'

interface Insight {
  type: 'trend' | 'recommendation' | 'prediction' | 'alert'
  title: string
  description: string
  metric?: string
  icon: React.ReactNode
  color: string
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function AdminIAPage() {
  const { reservations, loading } = useReservations()

  const insights = useMemo((): Insight[] => {
    if (reservations.length === 0) return []
    const result: Insight[] = []

    // Revenue trend (last 7 days vs previous 7 days)
    const now = new Date()
    const last7 = reservations.filter((r) => {
      const d = r.createdAt ? new Date(r.createdAt.seconds * 1000) : new Date(r.date)
      return (now.getTime() - d.getTime()) < 7 * 86400000
    })
    const prev7 = reservations.filter((r) => {
      const d = r.createdAt ? new Date(r.createdAt.seconds * 1000) : new Date(r.date)
      const diff = now.getTime() - d.getTime()
      return diff >= 7 * 86400000 && diff < 14 * 86400000
    })

    if (last7.length > prev7.length) {
      const pct = prev7.length > 0 ? Math.round(((last7.length - prev7.length) / prev7.length) * 100) : 100
      result.push({
        type: 'trend', title: 'Reservas en crecimiento',
        description: `Las reservas aumentaron ${pct}% en los últimos 7 días comparado con la semana anterior.`,
        metric: `+${pct}%`, icon: <FaArrowUp size={16} />, color: 'text-success-400',
      })
    } else if (last7.length < prev7.length && prev7.length > 0) {
      const pct = Math.round(((prev7.length - last7.length) / prev7.length) * 100)
      result.push({
        type: 'alert', title: 'Reservas en declive',
        description: `Las reservas disminuyeron ${pct}% esta semana. Considera promociones.`,
        metric: `-${pct}%`, icon: <FaArrowDown size={16} />, color: 'text-danger-400',
      })
    }

    // Peak day analysis
    const dayCount: Record<number, number> = {}
    reservations.forEach((r) => {
      const d = new Date(r.date + 'T12:00:00')
      const day = d.getDay()
      dayCount[day] = (dayCount[day] || 0) + 1
    })
    const peakDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]
    if (peakDay) {
      result.push({
        type: 'prediction', title: 'Día pico detectado',
        description: `El ${DAYS[Number(peakDay[0])]} es tu día más busy con ${peakDay[1]} reservas históricas. Asegúrate de tener suficientes paseadores.`,
        metric: DAYS[Number(peakDay[0])], icon: <FaCalendarAlt size={16} />, color: 'text-brand-400',
      })
    }

    // Service popularity
    const svcCount: Record<string, number> = {}
    reservations.forEach((r) => { svcCount[r.service] = (svcCount[r.service] || 0) + 1 })
    const topService = Object.entries(svcCount).sort((a, b) => b[1] - a[1])[0]
    if (topService) {
      const pct = Math.round((topService[1] / reservations.length) * 100)
      result.push({
        type: 'recommendation', title: 'Servicio estrella',
        description: `"${topService[0]}" representa el ${pct}% de tus reservas. Considera destacarlo en tu página.`,
        metric: `${pct}%`, icon: <FaStar size={16} />, color: 'text-accent-400',
      })
    }

    // Repeat client detection
    const clientPhones: Record<string, number> = {}
    reservations.forEach((r) => { clientPhones[r.phone] = (clientPhones[r.phone] || 0) + 1 })
    const repeatClients = Object.values(clientPhones).filter((c) => c > 1).length
    const totalClients = Object.keys(clientPhones).length
    const retentionRate = totalClients > 0 ? Math.round((repeatClients / totalClients) * 100) : 0
    result.push({
      type: 'recommendation', title: 'Retención de clientes',
      description: `El ${retentionRate}% de tus clientes repiten servicio. ${retentionRate > 50 ? 'Excelente fidelización.' : 'Considera un programa de lealtad.'}`,
      metric: `${retentionRate}%`, icon: <FaDog size={16} />, color: 'text-success-400',
    })

    // Average revenue per reservation
    const avgPerDay = reservations.length > 0 ? Math.round(reservations.length / Math.max(1, Math.ceil((now.getTime() - new Date(reservations[reservations.length - 1]?.date || now.toISOString()).getTime()) / 86400000))) : 0
    result.push({
      type: 'prediction', title: 'Promedio diario',
      description: `Tienes un promedio de ${avgPerDay} reserva(s) por día. ${avgPerDay < 3 ? 'Hay espacio para crecer.' : 'Buen ritmo.'}`,
      metric: `${avgPerDay}/día`, icon: <FaClock size={16} />, color: 'text-brand-400',
    })

    // Smart recommendation
    const pendingCount = reservations.filter((r) => r.status === 'pending').length
    if (pendingCount > 0) {
      result.push({
        type: 'alert', title: `${pendingCount} reserva(s) pendiente(s)`,
        description: 'Reservas sin confirmar ni completar. Atiéndelas para mejorar la experiencia del cliente.',
        metric: `${pendingCount}`, icon: <FaBrain size={16} />, color: 'text-danger-400',
      })
    }

    return result
  }, [reservations])

  // Day-of-week heatmap data
  const heatmap = useMemo(() => {
    const dayCount: Record<number, number> = {}
    reservations.forEach((r) => {
      const d = new Date(r.date + 'T12:00:00')
      dayCount[d.getDay()] = (dayCount[d.getDay()] || 0) + 1
    })
    const max = Math.max(...Object.values(dayCount), 1)
    return DAYS.map((day, i) => ({
      day,
      count: dayCount[i] || 0,
      intensity: (dayCount[i] || 0) / max,
    }))
  }, [reservations])

  // Hour distribution
  const hourDist = useMemo(() => {
    const hours: Record<number, number> = {}
    reservations.forEach((r) => {
      if (r.time) {
        const h = parseInt(r.time.split(':')[0])
        hours[h] = (hours[h] || 0) + 1
      }
    })
    const max = Math.max(...Object.values(hours), 1)
    return Object.entries(hours)
      .map(([h, c]) => ({ hour: Number(h), count: c, intensity: c / max }))
      .sort((a, b) => a.hour - b.hour)
  }, [reservations])

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-violet-600 flex items-center justify-center">
          <FaRobot size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Centro de IA</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Insights inteligentes basados en tus datos</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : reservations.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <FaRobot className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin datos suficientes para generar insights</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Los insights aparecen cuando tienes reservas registradas</p>
        </div>
      ) : (
        <>
          {/* Insights grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {insights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl p-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={insight.color}>{insight.icon}</div>
                  {insight.metric && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)' }}>
                      {insight.metric}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{insight.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{insight.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Day-of-week heatmap */}
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <FaCalendarAlt size={14} className="text-brand-400" />
              Distribución por día de la semana
            </h3>
            <div className="flex items-end justify-between gap-2 h-32">
              {heatmap.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-2xs font-medium" style={{ color: 'var(--text-muted)' }}>{h.count}</span>
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${Math.max(h.intensity * 100, 4)}%`,
                      background: h.intensity > 0.7 ? 'var(--primary)' : h.intensity > 0.3 ? 'rgba(230,126,34,0.4)' : 'rgba(230,126,34,0.15)',
                    }}
                  />
                  <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{h.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hour distribution */}
          {hourDist.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <FaClock size={14} className="text-brand-400" />
                Horas más solicitadas
              </h3>
              <div className="flex items-end gap-1 h-24">
                {hourDist.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${Math.max(h.intensity * 100, 4)}%`,
                        background: h.intensity > 0.7 ? 'var(--primary)' : h.intensity > 0.3 ? 'rgba(230,126,34,0.4)' : 'rgba(230,126,34,0.15)',
                      }}
                    />
                    <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{h.hour}h</span>
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
