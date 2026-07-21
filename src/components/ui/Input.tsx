'use client'

import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
  icon?: ReactNode
  rightElement?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, icon, rightElement, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const errorId = error ? `${inputId}-error` : undefined

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {label} {props.required && <span className="text-danger-400">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={errorId}
            aria-invalid={!!error}
            className={`
              w-full px-4 py-3 rounded-xl text-sm transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
              ${icon ? 'pl-10' : ''}
              ${rightElement ? 'pr-10' : ''}
              ${error ? 'border-danger-500 focus:ring-danger-500/30 focus:border-danger-500' : ''}
              ${className}
            `}
            style={{
              background: 'var(--glass-bg)',
              borderColor: error ? 'var(--color-error)' : 'var(--border)',
              color: 'var(--text-primary)',
            }}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-xs text-danger-400 flex items-center gap-1" role="alert">
            {error}
          </p>
        )}
        {helper && !error && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{helper}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
