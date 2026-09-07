import Image from 'next/image'
import { BRAND } from '@/lib/brand'

export function PawMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={BRAND.logoPath}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain"
      />
    </span>
  )
}

export function Logo({
  size = 36,
  rounded = 'rounded-xl',
  className = '',
}: {
  size?: number
  rounded?: string
  className?: string
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-ink/10 bg-white shadow-sm ${rounded} ${className}`}
      style={{ width: size, height: size }}
    >
      <PawMark size={Math.round(size * 0.9)} />
    </div>
  )
}
