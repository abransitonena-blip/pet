'use client'

import { ReactNode } from 'react'
import { FaArrowUp, FaArrowDown } from 'react-icons/fa'
import CountUp from './CountUp'

interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  change?: number
  trend?: 'up' | 'down' | 'neutral'
  color?: string
  className?: string
  animated?: boolean
}

export default function StatCard({ label, value, icon, change, trend = 'neutral', color = 'var(--color-primary)', className = '', animated = false }: StatCardProps) {
  const numericValue = typeof value === 'number' ? value : null
  const prefix = typeof value === 'string' ? value.replace(/[\d,.]+/, '') : ''
  const numFromStr = typeof value === 'string' ? parseInt(value.replace(/[^\d]/g, ''), 10) : null

  return (
    <div className={`rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:border-white/10 cursor-default group ${className}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
        {change !== undefined && trend !== 'neutral' && (
          <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: trend === 'up' ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {trend === 'up' ? <FaArrowUp size={10} /> : <FaArrowDown size={10} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {animated && numericValue !== null ? (
          <CountUp end={numericValue} prefix={prefix} />
        ) : animated && numFromStr !== null ? (
          <CountUp end={numFromStr} prefix={prefix} />
        ) : (
          value
        )}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}
