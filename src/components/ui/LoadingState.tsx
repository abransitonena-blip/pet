'use client'

interface LoadingStateProps {
  message?: string
  rows?: number
  height?: string
}

export default function LoadingState({ message = 'Cargando...', rows = 3, height = 'h-14' }: LoadingStateProps) {
  return (
    <div aria-busy="true" role="status">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`skeleton ${height} rounded-xl`} />
        ))}
      </div>
      <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>{message}</p>
      <span className="sr-only">{message}</span>
    </div>
  )
}
