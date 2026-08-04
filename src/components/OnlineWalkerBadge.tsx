'use client'

import { useOnlineWalkers } from '@/lib/useOnlineWalkers'
import { Circle } from 'lucide-react'

export default function OnlineWalkerBadge() {
  const { onlineWalkers, totalOnline, loading } = useOnlineWalkers()

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <span className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
        ...
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full" style={{
      background: totalOnline > 0 ? 'rgba(16,185,129,0.1)' : 'var(--glass-bg)',
      border: `1px solid ${totalOnline > 0 ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
      color: totalOnline > 0 ? 'var(--color-success)' : 'var(--text-muted)',
    }}>
      <Circle size={6} className={totalOnline > 0 ? 'text-success-500' : 'text-white/20'} />
      {totalOnline > 0 ? `${totalOnline} en línea` : 'Sin conexiones'}
    </span>
  )
}
