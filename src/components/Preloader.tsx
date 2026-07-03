'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaDog } from 'react-icons/fa'

export default function Preloader() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'var(--bg-primary)' }}
        >
          <div className="text-center">
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              className="text-7xl mb-6"
            >
              <FaDog
                className="inline-block"
                style={{ color: 'var(--primary)' }}
              />
            </motion.div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              transition={{ duration: 2, ease: 'easeInOut' }}
              className="h-1 rounded-full mx-auto overflow-hidden"
              style={{
                background: "rgba(230, 126, 34, 0.2)",
              }}
            >
              <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="h-full w-1/2 rounded-full"
                style={{ background: 'var(--primary)' }}
              />
            </motion.div>
            <motion.p
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-sm mt-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cargando...
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
