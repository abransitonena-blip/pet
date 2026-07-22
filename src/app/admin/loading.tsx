'use client'

import { FaDog } from 'react-icons/fa'

export default function AdminLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl" style={{ background: 'var(--glass-bg)' }} />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded" style={{ background: 'var(--glass-bg)' }} />
          <div className="h-3 w-48 rounded" style={{ background: 'var(--glass-bg)' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl" style={{ background: 'var(--glass-bg)' }} />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl" style={{ background: 'var(--glass-bg)' }} />
        ))}
      </div>
    </div>
  )
}
