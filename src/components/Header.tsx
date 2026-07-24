'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaDog, FaSun, FaMoon } from 'react-icons/fa'
import { useTheme } from '@/context/ThemeContext'

const navLinks = [
  { label: 'Inicio', href: '#hero' },
  { label: 'Planes', href: '#servicios' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Reseñas', href: '#resenas' },
  { label: 'Reservar', href: '#reservar' },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, toggle } = useTheme()

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
      className="fixed top-0 left-0 right-0 z-[var(--z-sticky)] transition-all duration-300"
      style={{
        background: scrolled ? 'var(--bg-card)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      }}
    >
      <nav className="section-container h-16 sm:h-18 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white"
          >
            <FaDog size={16} />
          </motion.div>
          <span className="text-base font-bold hidden sm:block" style={{ color: 'var(--text-primary)' }}>
            PET <span className="text-brand-400">Ap</span>
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={theme}
                initial={{ rotate: -90, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                exit={{ rotate: 90, scale: 0 }}
                transition={{ duration: 0.2 }}
              >
                {theme === 'dark' ? <FaSun size={14} /> : <FaMoon size={14} />}
              </motion.div>
            </AnimatePresence>
          </button>

          <a
            href="/login"
            className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all hover:bg-white/5 font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Acceder
          </a>

          <motion.a
            href="#reservar"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn-primary !py-2 !px-4 !text-xs"
          >
            Reservar
          </motion.a>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden relative w-8 h-8 flex items-center justify-center"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <div className="flex flex-col gap-1.5">
              <motion.span
                animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                className="w-5 h-[1.5px] block"
                style={{ background: 'var(--text-primary)' }}
              />
              <motion.span
                animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
                className="w-5 h-[1.5px] block"
                style={{ background: 'var(--text-primary)' }}
              />
              <motion.span
                animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                className="w-5 h-[1.5px] block"
                style={{ background: 'var(--text-primary)' }}
              />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 md:hidden"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="p-3 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMobile}
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <a
                  href="/login"
                  onClick={closeMobile}
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)' }}
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
