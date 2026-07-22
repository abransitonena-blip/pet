'use client'

export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center animate-pulse">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4" style={{ background: 'var(--glass-bg)' }} />
        <div className="h-6 w-48 rounded mx-auto mb-2" style={{ background: 'var(--glass-bg)' }} />
        <div className="h-4 w-36 rounded mx-auto" style={{ background: 'var(--glass-bg)' }} />
      </div>
    </div>
  )
}
