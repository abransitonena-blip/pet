'use client'

import { useState, useEffect } from 'react'
import { ThemeProvider } from '@/context/ThemeContext'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import HowItWorks from '@/components/HowItWorks'
import Services from '@/components/Services'
import Gallery from '@/components/Gallery'
import Reviews from '@/components/Reviews'
import ReservationForm from '@/components/ReservationForm'
import ReviewForm from '@/components/ReviewForm'
import Footer from '@/components/Footer'
import WhatsAppButton from '@/components/WhatsAppButton'
import AdminPanel from '@/components/AdminPanel'
import Preloader from '@/components/Preloader'
import TermsModal from '@/components/TermsModal'
import FloatingParticles from '@/components/FloatingParticles'

function HomeContent() {
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminCode, setAdminCode] = useState('')
  const [adminAttempt, setAdminAttempt] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAdmin(false)
        setAdminAttempt(false)
        setAdminCode('')
        setShowTerms(false)
        return
      }

      if (!adminAttempt) return

      if (e.key === 'Enter') {
        setShowAdmin(adminCode === 'admin123')
        setAdminAttempt(false)
        setAdminCode('')
        return
      }

      if (e.key === 'Backspace') {
        setAdminCode((prev) => prev.slice(0, -1))
        return
      }

      if (/^[a-zA-Z0-9]$/.test(e.key) && adminCode.length < 20) {
        setAdminCode((prev) => prev + e.key)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [adminAttempt, adminCode])

  const triggerAdmin = () => {
    setAdminAttempt(true)
    setAdminCode('')
  }

  return (
    <>
      {!loaded && <Preloader />}
      <main className="relative min-h-screen">
        <FloatingParticles />
        <Header onAdminTrigger={triggerAdmin} />
        <Hero />
        <HowItWorks />
        <Services />
        <Gallery />
        <Reviews />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="max-w-md mx-auto">
            <ReviewForm />
          </div>
        </div>
        <ReservationForm />
        <Footer onTerms={() => setShowTerms(true)} />
        <WhatsAppButton />
        <AdminPanel isOpen={showAdmin} onClose={() => setShowAdmin(false)} />
        <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
      </main>

      {adminAttempt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="rounded-2xl p-8 w-full max-w-sm mx-4 text-center"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="text-2xl mb-4">🔐</div>
            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Ingresa la clave de administrador
            </p>
            <div className="flex items-center justify-center gap-1 mb-4">
              {Array.from({ length: Math.max(adminCode.length, 1) }).map(
                (_, i) => (
                  <span
                    key={i}
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{ background: 'var(--primary)' }}
                  />
                )
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Presiona Enter para confirmar
            </p>
          </div>
        </div>
      )}
    </>
  )
}

export default function Home() {
  return (
    <ThemeProvider>
      <HomeContent />
    </ThemeProvider>
  )
}
