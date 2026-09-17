'use client'

import { useState, useEffect } from 'react'
import { watchDocument } from '@/firebase/lazyFirestore'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

const DISMISS_KEY = 'petap_banner_dismissed'

export default function BannerDisplay() {
  const [banner, setBanner] = useState<{ message: string; active: boolean } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return watchDocument(['admin', 'banner'], (raw) => {
      if (!raw) return
      const data = raw as { message: string; active: boolean }
      setBanner(data)
      if (data.active && data.message) {
        try {
          if (localStorage.getItem(DISMISS_KEY) === data.message) setDismissed(true)
        } catch { /* modo privado */ }
      }
    }, () => { /* sin banner, la pantalla sigue igual */ })
  }, [])

  const dismiss = () => {
    setDismissed(true)
    if (banner?.message) {
      try { localStorage.setItem(DISMISS_KEY, banner.message) } catch { /* noop */ }
    }
  }

  if (!banner?.active || !banner.message || dismissed) return null

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="relative bg-gradient-to-r from-primary/20 via-amber-600/10 to-primary/20 border-b border-primary/20"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-primary-hover text-center">
        <span>{banner.message}</span>
        <button
          onClick={dismiss}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/50 hover:text-primary transition-all"
          aria-label="Cerrar aviso"
        >
          <X size={12} />
        </button>
      </div>
    </motion.div>
  )
}
