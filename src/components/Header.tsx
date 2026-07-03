'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const navLinks = [
  { label: 'Inicio', href: '#hero' },
  { label: 'Servicios', href: '#servicios' },
  { label: 'Reseñas', href: '#resenas' },
  { label: 'Reservar', href: '#reservar' },
]

export default function Header({ onAdminTrigger }: { onAdminTrigger: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoClickCount, setLogoClickCount] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogoClick = () => {
    const newCount = logoClickCount + 1
    setLogoClickCount(newCount)
    if (newCount >= 5) {
      onAdminTrigger()
      setLogoClickCount(0)
    }
    setTimeout(() => setLogoClickCount(0), 2000)
  }

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-dark/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 group"
        >
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-lg"
          >
            P
          </motion.div>
          <span className="text-lg font-bold hidden sm:block">
            <span className="gradient-text">PetCare</span>
            <span className="text-white/60 ml-1">Quebrada</span>
          </span>
        </button>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link, i) => (
            <motion.a
              key={link.href}
              href={link.href}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-sm text-white/60 hover:text-white relative group transition-colors"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-primary group-hover:w-full transition-all duration-300" />
            </motion.a>
          ))}
        </div>

        <motion.a
          href="#reservar"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="btn-primary text-sm !py-2 !px-5 hidden sm:block"
        >
          Reservar ahora
        </motion.a>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden relative w-8 h-8 flex items-center justify-center"
        >
          <div className="flex flex-col gap-1.5">
            <motion.span
              animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
              className="w-6 h-[2px] bg-white block"
            />
            <motion.span
              animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
              className="w-6 h-[2px] bg-white block"
            />
            <motion.span
              animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
              className="w-6 h-[2px] bg-white block"
            />
          </div>
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-dark/95 backdrop-blur-xl border-t border-white/5 overflow-hidden"
          >
            <div className="px-4 py-6 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-lg text-white/70 hover:text-white transition-colors py-2"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#reservar"
                onClick={() => setMobileOpen(false)}
                className="btn-primary text-center mt-2"
              >
                Reservar ahora
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
