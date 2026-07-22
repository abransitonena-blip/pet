'use client'

import { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-white/[0.06] text-slate-400',
  success: 'bg-success-500/15 text-success-400',
  warning: 'bg-amber-500/15 text-amber-400',
  danger: 'bg-danger-500/15 text-danger-400',
  info: 'bg-blue-500/15 text-blue-400',
  brand: 'bg-brand-500/15 text-brand-400',
}

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  )
}
