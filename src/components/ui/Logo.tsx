export function PawMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="#FFF8F1" aria-hidden="true" className={className}>
      <ellipse cx="50" cy="61" rx="18.5" ry="13.5" />
      <ellipse cx="33" cy="45" rx="9" ry="8.2" transform="rotate(-22 33 45)" />
      <ellipse cx="50" cy="39" rx="9.5" ry="8.6" />
      <ellipse cx="67" cy="45" rx="9" ry="8.2" transform="rotate(22 67 45)" />
    </svg>
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
      className={`bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0 ${rounded} ${className}`}
      style={{ width: size, height: size }}
    >
      <PawMark size={Math.round(size * 0.58)} />
    </div>
  )
}
