'use client'

interface MoneyProps {
  value?: number | null
  className?: string
  locale?: string
  currency?: string
}

export default function Money({ value, className, locale = 'es-MX', currency = 'MXN' }: MoneyProps) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return <span className={className}>—</span>
  }
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
  return <span className={className}>{formatted}</span>
}
