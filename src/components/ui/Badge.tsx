'use client'

import { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-ink/5 text-[var(--text-muted)]',
  success: 'bg-success-500/15 text-success-600',
  warning: 'bg-amber-500/15 text-amber-800',
  danger: 'bg-danger-500/15 text-red-700',
  info: 'bg-blue-500/15 text-blue-700',
  brand: 'bg-brand-500/15 text-brand-600',
}

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  )
}
