'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FaTimes } from 'react-icons/fa'

export default function BannerDisplay() {
  const [banner, setBanner] = useState<{ message: string; active: boolean } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'admin', 'banner'), (snap) => {
      if (snap.exists()) setBanner(snap.data() as { message: string; active: boolean })
    })
    return unsub
  }, [])

  if (!banner?.active || !banner.message || dismissed) return null

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="relative bg-gradient-to-r from-primary/20 via-amber-600/10 to-primary/20 border-b border-primary/20"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-primary text-center">
        <span>{banner.message}</span>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/50 hover:text-primary transition-all"
        >
          <FaTimes size={12} />
        </button>
      </div>
    </motion.div>
  )
}
