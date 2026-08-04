'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const navLinks = [
  { label: 'Inicio', href: '#hero' },
  { label: 'Servicios', href: '#servicios' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Reseñas', href: '#resenas' },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-sticky transition-all duration-300"
      style={{
        background: scrolled ? 'var(--glass-bg)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--glass-border)' : '1px solid transparent',
      }}
    >
      <nav className="section-container h-16 sm:h-18 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 group">
          <motion.div whileHover={{ scale: 1.05 }}>
            <Logo size={36} />
          </motion.div>
          <span className="text-base font-bold hidden sm:block text-ink">
            PET <span className="text-primary">Ap</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-primary/5 text-muted hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/login"
            className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all hover:bg-primary/5 font-medium text-muted hover:text-ink"
          >
            Acceder
          </a>

          <motion.a
            href="/login"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn-primary !py-2 !px-4 !text-xs"
          >
            Entrar a Familia PET
          </motion.a>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden relative w-11 h-11 flex items-center justify-center text-ink"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.14 }}
            className="absolute top-full left-0 right-0 md:hidden"
            style={{
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div className="p-3 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMobile}
                  className="block px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-primary/5 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2 border-t border-border">
                <a
                  href="/login"
                  onClick={closeMobile}
                  className="block px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-primary/5 transition-colors"
                >
                  Iniciar sesión
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
