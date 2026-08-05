'use client'

import { STATUS_LABELS, STATUS_COLORS, type SessionStatus } from '@/lib/sessionMachine'
import { LEGACY_STATUS_MAP } from '@/lib/sessionMachine'

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const normalized: SessionStatus = LEGACY_STATUS_MAP[status] || (STATUS_LABELS[status as SessionStatus] ? (status as SessionStatus) : 'pending')
  const colors = STATUS_COLORS[normalized] || STATUS_COLORS.pending
  const label = STATUS_LABELS[normalized] || status || 'Pendiente'

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-semibold ${colors.bg} ${colors.text} ${className}`}
    >
      {label}
    </span>
  )
}
