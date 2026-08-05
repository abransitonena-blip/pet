'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  backHref?: string
  backLabel?: string
}

export default function PageHeader({ title, description, actions, backHref, backLabel }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 transition-colors hover:text-ink"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={14} />
          {backLabel || 'Volver'}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          {description && (
            <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--text-muted)' }}>{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
