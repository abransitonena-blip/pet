'use client'

interface AvatarProps {
  name: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'w-7 h-7 text-2xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
}

export default function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${sizeStyles[size]} ${className}`}
      />
    )
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-brand-500 to-success-500 flex items-center justify-center text-white font-bold ${sizeStyles[size]} ${className}`}
    >
      {initials}
    </div>
  )
}
