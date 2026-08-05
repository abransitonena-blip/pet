'use client'

import { ReactNode } from 'react'

interface EntityAvatarProps {
  name?: string
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'w-8 h-8 text-2xs',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
}

export default function EntityAvatar({ name, icon, size = 'md', className = '' }: EntityAvatarProps) {
  const initials = (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className={`rounded-xl flex items-center justify-center shrink-0 ${sizeStyles[size]} ${className}`}
      style={{ background: 'var(--color-brand-soft)', color: 'var(--color-primary)' }}
      aria-hidden="true"
    >
      {icon || <span className="font-bold">{initials}</span>}
    </div>
  )
}
