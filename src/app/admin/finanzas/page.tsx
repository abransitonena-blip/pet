'use client'

import { useState, useMemo } from 'react'
import { FaDollarSign, FaChartBar, FaDownload, FaFilter } from 'react-icons/fa'
import { getServicePrice } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import { useReservations } from '@/context/ReservationsContext'
import type { Reservation } from '@/types'

export default function AdminFinanzasPage() {
  const { reservations, loading } = useReservations()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all')
  const { prices } = usePrices()

  const getEffectivePrice = (serviceName: string) => prices[serviceName] ?? getServicePrice(serviceName)

  const dateFiltered = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    let result = reservations

    if (datePreset === 'today') {
      result = result.filter((r) => r.date === today)
    } else if (datePreset === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      result = result.filter((r) => r.date >= weekAgo)
    } else if (datePreset === 'month') {
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
      result = result.filter((r) => r.date >= monthAgo)
    } else if (datePreset === 'year') {
      const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]
      result = result.filter((r) => r.date >= yearAgo)
    } else if (dateFrom || dateTo) {
      if (dateFrom) result = result.filter((r) => r.date >= dateFrom)
      if (dateTo) result = result.filter((r) => r.date <= dateTo)
    }

    return result
  }, [reservations, datePreset, dateFrom, dateTo])

  const stats = useMemo(() => {
    const completed = dateFiltered.filter((r) => r.status === 'completed')
    const pending = dateFiltered.filter((r) => r.status === 'pending' || (!r.status && r.status !== 'cancelled'))
    const paid = completed.filter((r) => r.paymentStatus === 'paid')
    const unpaid = completed.filter((r) => r.paymentStatus !== 'paid')

    const totalRevenue = completed.reduce((sum, r) => sum + getEffectivePrice(r.service), 0)
    const collectedAmount = paid.reduce((sum, r) => sum + getEffectivePrice(r.service), 0)
    const pendingAmount = unpaid.reduce((sum, r) => sum + getEffectivePrice(r.service), 0)
    const potentialPending = pending.reduce((sum, r) => sum + getEffectivePrice(r.service), 0)

    return {
      totalReservations: dateFiltered.length,
      completedReservations: completed.length,
      totalRevenue,
      collectedAmount,
      pendingAmount,
      potentialPending,
      avgTicket: completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0,
    }
  }, [dateFiltered, getEffectivePrice])

  const serviceBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number }> = {}
    dateFiltered.filter((r) => r.status === 'completed').forEach((r) => {
      if (!counts[r.service]) counts[r.service] = { count: 0, revenue: 0 }
      counts[r.service].count++
      counts[r.service].revenue += getEffectivePrice(r.service)
    })
    return Object.entries(counts)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([service, data]) => ({ service, ...data }))
  }, [dateFiltered, getEffectivePrice])

  const dailyRevenue = useMemo(() => {
    const today = new Date()
    const days: { date: string; label: string; revenue: number; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      days.push({
        date: dateStr,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        revenue: 0,
        count: 0,
      })
    }
    dateFiltered.filter((r) => r.status === 'completed').forEach((r) => {
      const day = days.find((d) => d.date === r.date)
      if (day) {
        day.revenue += getEffectivePrice(r.service)
        day.count++
      }
    })
    return days
  }, [dateFiltered, getEffectivePrice])

  const maxRevenue = Math.max(...dailyRevenue.map((d) => d.revenue), 1)

  const exportCSV = () => {
    const headers = ['Fecha', 'Cliente', 'Mascota', 'Servicio', 'Monto', 'Estado Pago', 'Paseador']
    const rows = dateFiltered.map((r) => [
      r.date, r.name, r.petName, r.service,
      `$${getEffectivePrice(r.service)}`,
      r.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente',
      r.assignedWalker || '',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finanzas-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Finanzas</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Ingresos, pagos y rendimiento financiero
          </p>
        </div>
        <button onClick={exportCSV} className="btn-secondary !text-xs flex items-center gap-1.5">
          <FaDownload size={12} /> Exportar
        </button>
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all' as const, label: 'Todo' },
          { key: 'today' as const, label: 'Hoy' },
          { key: 'week' as const, label: '7 días' },
          { key: 'month' as const, label: '30 días' },
          { key: 'year' as const, label: 'Año' },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => { setDatePreset(p.key); if (p.key === 'all') { setDateFrom(''); setDateTo('') } }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              datePreset === p.key ? 'bg-brand-500/15 text-brand-400' : 'bg-white/[0.04] text-white/40 hover:text-white/60'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {datePreset === 'all' && (
        <div className="flex gap-3">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field !w-auto text-xs" title="Desde" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field !w-auto text-xs" title="Hasta" />
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Ingresos totales', value: `$${stats.totalRevenue.toLocaleString()}`, color: '#D97706' },
              { label: 'Cobrado', value: `$${stats.collectedAmount.toLocaleString()}`, color: '#059669' },
              { label: 'Por cobrar', value: `$${stats.pendingAmount.toLocaleString()}`, color: '#DC2626' },
              { label: 'Ticket promedio', value: `$${stats.avgTicket}`, color: '#3b82f6' },
              { label: 'Completadas', value: stats.completedReservations, color: '#7C3AED' },
              { label: 'Pendientes', value: stats.totalReservations - stats.completedReservations, color: '#f59e0b' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Revenue chart (bar chart) */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Ingresos diarios (últimos 14 días)</p>
            <div className="flex items-end gap-1 h-32">
              {dailyRevenue.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-brand-500/60 transition-all hover:bg-brand-500 min-h-[2px]"
                    style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}
                    title={`${d.label}: $${d.revenue} (${d.count} reservas)`}
                  />
                  <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Service breakdown */}
          {serviceBreakdown.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Ingresos por servicio</p>
              <div className="space-y-2">
                {serviceBreakdown.map((s) => {
                  const maxRev = serviceBreakdown[0]?.revenue || 1
                  return (
                    <div key={s.service}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-primary)' }}>{s.service}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{s.count} reservas · ${s.revenue.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div
                          className="h-full rounded-full bg-brand-500/50"
                          style={{ width: `${(s.revenue / maxRev) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
