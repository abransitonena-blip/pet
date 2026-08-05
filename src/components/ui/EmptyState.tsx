'use client'

import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-10 ${className}`}>
      {icon && (
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-ink/5">
          <span className="text-xl" style={{ color: 'var(--text-muted)' }}>{icon}</span>
        </div>
      )}
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {description && (
        <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
