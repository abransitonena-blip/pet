'use client'

import { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  htmlFor?: string
  error?: string | null
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}

export default function FormField({ label, htmlFor, error, hint, required, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {required && <span className="text-danger-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-2xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      {error && <p className="text-xs mt-1" role="alert" style={{ color: 'var(--color-error)' }}>{error}</p>}
    </div>
  )
}
