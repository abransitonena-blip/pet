'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Services from '@/components/Services'
import Reviews from '@/components/Reviews'
import ReservationForm from '@/components/ReservationForm'
import Footer from '@/components/Footer'
import WhatsAppButton from '@/components/WhatsAppButton'
import AdminPanel from '@/components/AdminPanel'
import FloatingParticles from '@/components/FloatingParticles'

export default function Home() {
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminCode, setAdminCode] = useState('')
  const [adminAttempt, setAdminAttempt] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAdmin(false)
        setAdminAttempt(false)
        setAdminCode('')
        return
      }

      if (!adminAttempt) return

      if (e.key === 'Enter') {
        if (adminCode === 'admin123') {
          setShowAdmin(true)
          setAdminAttempt(false)
          setAdminCode('')
        } else {
          setAdminAttempt(false)
          setAdminCode('')
        }
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
    <main className="relative min-h-screen">
      <FloatingParticles />
      <Header onAdminTrigger={triggerAdmin} />
      <Hero />
      <Services />
      <Reviews />
      <ReservationForm />
      <Footer />
      <WhatsAppButton />
      <AdminPanel
        isOpen={showAdmin}
        onClose={() => setShowAdmin(false)}
      />

      {adminAttempt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="glass-card p-8 w-full max-w-sm mx-4 text-center">
            <div className="text-2xl mb-4">🔐</div>
            <p className="text-white/70 mb-4 text-sm">
              Ingresa la clave de administrador
            </p>
            <div className="flex items-center justify-center gap-1 mb-4">
              {Array.from({ length: Math.max(adminCode.length, 1) }).map(
                (_, i) => (
                  <span
                    key={i}
                    className="w-3 h-3 rounded-full bg-primary animate-pulse"
                  />
                )
              )}
            </div>
            <p className="text-xs text-white/40">
              Presiona Enter para confirmar
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
