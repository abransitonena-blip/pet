'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { FaLock, FaDog, FaUser, FaWalking } from 'react-icons/fa'

export default function HiddenAdminAccess() {
  const router = useRouter()
  const [showLogin, setShowLogin] = useState(false)
  const clickCount = useRef(0)
  const clickTimer = useRef<NodeJS.Timeout | null>(null)

  const handleLogoClick = useCallback(() => {
    clickCount.current += 1

    if (clickTimer.current) clearTimeout(clickTimer.current)

    if (clickCount.current >= 6) {
      clickCount.current = 0
      setShowLogin(true)
    }

    clickTimer.current = setTimeout(() => {
      clickCount.current = 0
    }, 2000)
  }, [])

  return (
    <>
      {/* Hidden trigger — 6 rapid clicks on the logo */}
      <button
        onClick={handleLogoClick}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      >
        PET Ap
      </button>

      <AnimatePresence>
        {showLogin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
            role="dialog"
            aria-modal="true"
            aria-label="Acceso interno"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl p-6 space-y-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
                  <FaLock size={20} className="text-brand-400" />
                </div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Acceso Interno</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Selecciona tu rol</p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => { setShowLogin(false); router.push('/login?mode=equipo') }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/5"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                    <FaDog size={16} className="text-brand-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Administrador</p>
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Centro de operaciones</p>
                  </div>
                </button>

                <button
                  onClick={() => { setShowLogin(false); router.push('/login?mode=paseador') }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/5"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <FaWalking size={16} className="text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Paseador</p>
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Panel de paseos</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowLogin(false)}
                className="w-full text-xs py-2 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: 'var(--text-muted)' }}
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
