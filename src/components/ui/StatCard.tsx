'use client'

import { ReactNode } from 'react'
import { FaArrowUp, FaArrowDown } from 'react-icons/fa'

interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  change?: number
  trend?: 'up' | 'down' | 'neutral'
  color?: string
  className?: string
}

export default function StatCard({ label, value, icon, change, trend = 'neutral', color = 'var(--color-primary)', className = '' }: StatCardProps) {
  return (
    <div className={`rounded-2xl p-5 transition-all duration-200 ${className}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
        {change !== undefined && trend !== 'neutral' && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend === 'up' ? 'text-success-400' : 'text-danger-400'}`}>
            {trend === 'up' ? <FaArrowUp size={10} /> : <FaArrowDown size={10} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}
