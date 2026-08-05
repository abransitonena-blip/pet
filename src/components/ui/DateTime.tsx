'use client'

interface DateTimeProps {
  date?: string | { seconds?: number; nanoseconds?: number } | null
  time?: string
  format?: 'short' | 'long'
  className?: string
}

function toDate(value: DateTimeProps['date']): Date | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value.length === 10 ? value + 'T12:00:00' : value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000)
  }
  return null
}

export default function DateTime({ date, time, format = 'short', className }: DateTimeProps) {
  const d = toDate(date)
  const parts: string[] = []
  if (d) {
    parts.push(
      new Intl.DateTimeFormat('es-MX', {
        day: format === 'long' ? 'numeric' : '2-digit',
        month: format === 'long' ? 'long' : 'short',
        ...(format === 'long' ? { year: 'numeric' } : {}),
      }).format(d)
    )
  }
  if (time) parts.push(time)
  if (parts.length === 0) return <span className={className}>—</span>
  return <span className={className}>{parts.join(' · ')}</span>
}
