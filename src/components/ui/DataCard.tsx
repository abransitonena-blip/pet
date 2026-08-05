'use client'

import { ReactNode } from 'react'

interface DataCardProps {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}

export default function DataCard({ title, action, children, className = '', padded = true }: DataCardProps) {
  return (
    <div
      className={`rounded-2xl ${padded ? 'p-5' : ''} ${className}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {(title || action) && (
        <div className={`flex items-center justify-between gap-4 ${padded ? 'mb-4' : 'p-5 pb-4 border-b'}`} style={padded ? {} : { borderColor: 'var(--border)' }}>
          {title && (
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
