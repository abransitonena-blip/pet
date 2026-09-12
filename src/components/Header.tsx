'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

// En el orden en que la página los presenta. "¿Llegamos?" va pronto porque es
// la primera pregunta de quien no nos conoce.
const navLinks = [
  { label: 'Inicio', href: '/#hero' },
  { label: 'Servicios', href: '/#servicios' },
  { label: 'Precios', href: '/#precios' },
  { label: 'Cómo funciona', href: '/#como-funciona' },
  { label: '¿Llegamos?', href: '/#cobertura' },
  { label: 'Reseñas', href: '/#resenas' },
  { label: 'Contacto', href: '/#contacto' },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  /**
   * Two things used to break tapping a section from the open menu: the menu sets
   * `body { overflow: hidden }` and React only clears it on the next render, so
   * the browser's anchor jump was blocked; and the jump itself relied on smooth
   * scrolling, which is paused whenever the page is not visible. So: clear the
   * lock synchronously, then scroll ourselves, instantly, offset by the fixed
   * header. Nothing here depends on an animation completing.
   */
  const HEADER_OFFSET = 80

  const goToSection = useCallback((event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    document.body.style.overflow = ''
    closeMobile()
    const id = href.split('#')[1]
    const target = id ? document.getElementById(id) : null
    if (!target) return
    event.preventDefault()
    const top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' })
    window.history.replaceState(null, '', href)
  }, [closeMobile, reduceMotion])

  const releaseScrollLock = useCallback(() => {
    document.body.style.overflow = ''
    closeMobile()
  }, [closeMobile])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])

  return (
    // No entrance transform here on purpose: this header carries the only nav on the
    // page, so it must be fully in place and clickable from the very first frame,
    // never mid-animation. A stalled/interrupted slide-in previously left it (and its
    // links) offset and unreliable to click.
    <header
      className="fixed top-0 left-0 right-0 z-sticky transition-all duration-200 motion-reduce:transition-none"
      style={{
        background: scrolled ? 'var(--glass-bg)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--glass-border)' : '1px solid transparent',
      }}
    >
      <nav className="section-container h-16 sm:h-18 flex items-center justify-between">
        <a href="/" className="group flex min-h-11 min-w-11 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <motion.div whileHover={reduceMotion ? undefined : { scale: 1.05 }}>
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
              onClick={(event) => goToSection(event, link.href)}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-primary/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/login"
            className="hidden min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted transition-colors hover:bg-primary/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none sm:flex"
          >
            Acceder
          </a>

          <motion.a
            href="/login"
            whileHover={reduceMotion ? undefined : { scale: 1.03 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className="btn btn-primary !min-h-11 !px-4 !py-2 !text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Entrar a Familia PET
          </motion.a>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          // Navigation must never be invisible-but-present: animate the slide only,
          // never opacity, so a stalled/skipped transition still leaves the menu usable.
          <motion.div
            initial={{ y: -10 }}
            animate={{ y: 0 }}
            exit={{ y: -10 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
            className="absolute top-full left-0 right-0 opacity-100 md:hidden"
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
                  onClick={(event) => goToSection(event, link.href)}
                  className="flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-muted transition-colors hover:bg-primary/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2 border-t border-border">
                <a
                  href="/login"
                  onClick={releaseScrollLock}
                  className="flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-muted transition-colors hover:bg-primary/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                >
                  Iniciar sesión
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
