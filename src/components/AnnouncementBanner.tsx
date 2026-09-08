'use client'

import { useEffect, useState } from 'react'
import { useConfig } from '@/context/ConfigContext'
import { getActiveAnnouncements } from '@/lib/announcements'
import { Events } from '@/lib/analytics'

const DISMISS_KEY_PREFIX = 'petap-announcement-dismissed-'

export default function AnnouncementBanner() {
  const { config } = useConfig()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)

  const active = getActiveAnnouncements(config.announcements)

  useEffect(() => {
    try {
      const stored = active
        .map((item) => item.id)
        .filter((id) => window.localStorage.getItem(DISMISS_KEY_PREFIX + id) === '1')
      setDismissed(new Set(stored))
    } catch {
      // localStorage unavailable (private mode, etc.) — show the banner anyway.
    }
    setHydrated(true)
    // Only needs to run once per mount; re-checking on every config change would
    // re-read storage for announcements that haven't changed.
  }, [])

  const visible = active.filter((item) => !dismissed.has(item.id))
  if (!hydrated || visible.length === 0) return null

  const dismiss = (id: string) => {
    setDismissed((current) => new Set(current).add(id))
    Events.announcementDismissed(id)
    try {
      window.localStorage.setItem(DISMISS_KEY_PREFIX + id, '1')
    } catch {
      // Best effort — the banner still hides for this page view either way.
    }
  }

  return (
    <div className="space-y-2 px-4 pt-3 sm:px-6 lg:px-8" role="region" aria-label="Anuncios">
      {visible.map((item) => (
        <div key={item.id} role="status" className="mx-auto flex max-w-4xl items-start gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-ink">
          <span aria-hidden="true" className="text-lg leading-none">{item.icon}</span>
          <div className="min-w-0 flex-1">
            {item.title && <p className="font-semibold">{item.title}</p>}
            <p className="text-muted">{item.message}</p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Cerrar anuncio"
            className="shrink-0 rounded-full px-2 py-1 text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
