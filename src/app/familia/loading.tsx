'use client'

export default function MiCuentaLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-32 rounded" style={{ background: 'var(--glass-bg)' }} />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl" style={{ background: 'var(--glass-bg)' }} />
        ))}
      </div>
    </div>
  )
}
