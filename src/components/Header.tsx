'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaDog, FaSun, FaMoon, FaTimes, FaUser } from 'react-icons/fa'
import { useTheme } from '@/context/ThemeContext'

const navLinks = [
  { label: 'Inicio', href: '#hero' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Paquetes', href: '#servicios' },
  { label: 'Galería', href: '#galeria' },
  { label: 'Reseñas', href: '#resenas' },
  { label: 'Reservar', href: '#reservar' },
]

export default function Header({ onAdminTrigger, onClientLogin, clientLoggedIn }: { onAdminTrigger: () => void; onClientLogin: () => void; clientLoggedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoClickCount, setLogoClickCount] = useState(0)
  const { theme, toggle } = useTheme()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleLogoClick = () => {
    const newCount = logoClickCount + 1
    setLogoClickCount(newCount)
    if (newCount >= 5) {
      onAdminTrigger()
      setLogoClickCount(0)
    }
    setTimeout(() => setLogoClickCount(0), 2000)
  }

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? 'var(--bg-primary)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        <button onClick={handleLogoClick} className="flex items-center gap-2 group touch-action-manipulation">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white font-bold text-lg"
          >
            <FaDog />
          </motion.div>
          <span className="text-lg font-bold hidden sm:block" style={{ willChange: 'auto' }}>
            <span className="gradient-text">Paseos</span>
            <span style={{ color: 'var(--text-secondary)' }} className="ml-1">Quebrada</span>
          </span>
        </button>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link, i) => (
            <motion.a
              key={link.href}
              href={link.href}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-sm relative group transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-primary group-hover:w-full transition-all duration-300" />
            </motion.a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 touch-action-manipulation"
            style={{ color: 'var(--text-secondary)' }}
          >
            {theme === 'dark' ? <FaSun size={16} /> : <FaMoon size={16} />}
          </button>

          <button
            onClick={onClientLogin}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all touch-action-manipulation hidden sm:flex"
            style={{
              background: clientLoggedIn ? 'var(--glass-bg)' : 'var(--glass-bg)',
              color: clientLoggedIn ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <FaUser size={10} />
            {clientLoggedIn ? 'Mi cuenta' : 'Iniciar sesión'}
          </button>

          <motion.a
            href="#reservar"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-primary text-sm !py-2 !px-5 hidden sm:block"
          >
            Reservar paseo
          </motion.a>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden relative w-8 h-8 flex items-center justify-center touch-action-manipulation"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <div className="flex flex-col gap-1.5">
              <motion.span
                animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                className="w-6 h-[2px] block"
                style={{ background: 'var(--text-primary)' }}
              />
              <motion.span
                animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
                className="w-6 h-[2px] block"
                style={{ background: 'var(--text-primary)' }}
              />
              <motion.span
                animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                className="w-6 h-[2px] block"
                style={{ background: 'var(--text-primary)' }}
              />
            </div>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm md:hidden z-40"
              onClick={closeMobile}
            />
            <motion.div
              key="mobile-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-[85vw] max-w-sm md:hidden z-50 overflow-y-auto"
              style={{
                background: 'var(--bg-card)',
                borderLeft: '1px solid var(--border)',
                boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
              }}
            >
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="font-bold gradient-text text-base">Menú</span>
                <button
                  onClick={closeMobile}
                  className="w-8 h-8 rounded-full flex items-center justify-center touch-action-manipulation"
                  style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)' }}
                >
                  <FaTimes size={14} />
                </button>
              </div>
              <div className="p-4 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={closeMobile}
                    className="text-base py-3 px-4 rounded-xl transition-all touch-action-manipulation active:scale-[0.98]"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--glass-bg)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }}
                  >
                    {link.label}
                  </a>
                ))}
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button
                    onClick={() => { closeMobile(); onClientLogin(); }}
                    className="w-full text-sm py-3 px-4 rounded-xl transition-all text-left touch-action-manipulation"
                    style={{ color: clientLoggedIn ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    {clientLoggedIn ? 'Mi cuenta' : 'Iniciar sesión'}
                  </button>
                  <div className="mt-1">
                    <a
                      href="#reservar"
                      onClick={closeMobile}
                      className="btn-primary text-center block text-sm py-3"
                    >
                      Reservar paseo
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
