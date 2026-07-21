'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { FaSpinner } from 'react-icons/fa'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:shadow-glow focus-visible:ring-brand-400',
  secondary: 'border border-border bg-transparent text-slate-200 hover:border-brand-500/30 hover:bg-glass-bg focus-visible:ring-brand-400',
  ghost: 'text-slate-400 hover:text-white hover:bg-white/5 focus-visible:ring-brand-400',
  danger: 'bg-danger-500 text-white hover:bg-danger-600 focus-visible:ring-danger-400',
  success: 'bg-success-500 text-white hover:bg-success-600 focus-visible:ring-success-400',
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-7 py-3.5 text-base rounded-xl gap-2.5',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, disabled, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-semibold
          transition-all duration-200 ease-out
          active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? <FaSpinner className="animate-spin" size={size === 'sm' ? 12 : 14} /> : icon}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
