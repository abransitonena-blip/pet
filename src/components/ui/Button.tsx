"use client"

import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  icon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      icon,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'inline-flex min-h-11 items-center justify-center font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:transform-none'

    const variantClasses = {
      primary: 'bg-primary text-white hover:bg-primary-hover active:scale-[0.98]',
      secondary: 'border border-ink/20 bg-surface text-ink hover:border-ink/35 hover:bg-ink/[0.03] active:scale-[0.98]',
      ghost: 'bg-transparent text-muted hover:bg-ink/[0.05] hover:text-ink active:scale-[0.98]',
      danger: 'bg-danger text-white hover:bg-danger-600 active:scale-[0.98]',
      icon: 'h-11 w-11 rounded-full bg-transparent p-0 text-muted hover:bg-ink/[0.05] hover:text-ink active:scale-[0.98]'
    }

    const sizeClasses = {
      // Pills: a button is always a single line, so a full radius never
      // produces the odd lozenge a multi-line block would.
      sm: 'h-11 px-4 text-sm rounded-full gap-1.5',
      md: 'h-11 px-5 text-sm rounded-full gap-2',
      lg: 'h-12 px-7 text-base rounded-full gap-2.5'
    }

    const effectiveLeftIcon = isLoading ? undefined : (leftIcon ?? icon)

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        disabled={disabled || isLoading}
        onClick={onClick}
        {...props}
      >
        {isLoading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        )}
        {!isLoading && effectiveLeftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
