'use client'

import { AlertTriangle } from 'lucide-react'
import { useConfig } from '@/context/ConfigContext'

export default function ConfigErrorBanner() {
  const { configError } = useConfig()

  if (!configError) return null

  return (
    <div
      role="alert"
      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-center"
      style={{ background: 'rgba(220,38,38,0.12)', borderBottom: '1px solid rgba(220,38,38,0.35)', color: 'var(--color-danger)' }}
    >
      <AlertTriangle size={14} className="shrink-0" />
      <span>{configError}</span>
    </div>
  )
}
