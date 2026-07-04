'use client'

import { useState, useEffect } from 'react'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '@/firebase/config'
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
import FAQ from '@/components/FAQ'
import WalkTips from '@/components/WalkTips'
import WalkReminder from '@/components/WalkReminder'
import PetProfileManager from '@/components/PetProfileManager'
import LoyaltyProgram from '@/components/LoyaltyProgram'
import ReferralSection from '@/components/ReferralSection'
import AvailabilityCalendar from '@/components/AvailabilityCalendar'
import PWARegister from '@/components/PWARegister'
import ContactSection from '@/components/ContactSection'

function HomeContent() {
  const [showAdmin, setShowAdmin] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [showTerms, setShowTerms] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [userPhone, setUserPhone] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) setShowLogin(false)
    })
    return unsub
  }, [])

  const handleLogin = async () => {
    setLoginError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
      setShowAdmin(true)
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setLoginError('Correo o contraseña incorrectos')
      } else if (e.code === 'auth/invalid-email') {
        setLoginError('Correo inválido')
      } else if (e.code === 'auth/too-many-requests') {
        setLoginError('Demasiados intentos. Espera un momento')
      } else {
        setLoginError('Error al iniciar sesión')
      }
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    setShowAdmin(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  const triggerAdmin = () => {
    if (user) {
      setShowAdmin(true)
    } else {
      setShowLogin(true)
      setEmail('')
      setPassword('')
      setLoginError('')
    }
  }

  return (
    <>
      <PWARegister />
      {!loaded && <Preloader />}
      <main className="relative min-h-screen">
        <FloatingParticles />
        <Header onAdminTrigger={triggerAdmin} />
        <Hero />
        <HowItWorks />
        <Services />
        <Gallery />
        <FAQ />
        <WalkTips />
        <Reviews />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="max-w-md mx-auto">
            <ReviewForm />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <PetProfileManager onSelect={(profile) => {
              const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]')
              const phoneInput = document.querySelector<HTMLInputElement>('input[name="phone"]')
              const petInput = document.querySelector<HTMLInputElement>('input[name="petName"]')
              const petTypeSelect = document.querySelector<HTMLSelectElement>('select[name="petType"]')
              if (nameInput) nameInput.value = profile.ownerName
              if (phoneInput) phoneInput.value = profile.phone
              if (petInput) petInput.value = profile.name
              if (petTypeSelect) petTypeSelect.value = profile.type
              setUserPhone(profile.phone)
              setTimeout(() => document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth' }), 300)
            }} />
            <WalkReminder />
            <div>
              <LoyaltyProgram phone={userPhone} />
              <div className="mt-4">
                <ReferralSection phone={userPhone} />
              </div>
            </div>
          </div>
        </div>

        <ReservationForm onPhoneChange={setUserPhone} />
        <ContactSection />
        <Footer onTerms={() => setShowTerms(true)} />
        <WhatsAppButton />
        <AdminPanel
          isOpen={showAdmin}
          onClose={() => setShowAdmin(false)}
          user={user}
          onLogout={handleLogout}
        />
        <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
      </main>

      {showLogin && !user && (
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
              Acceso administrador
            </p>
            <div className="space-y-3 text-left">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Correo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="admin@correo.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
                />
              </div>
              {loginError && (
                <p className="text-red-400 text-xs">{loginError}</p>
              )}
              <button
                onClick={handleLogin}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-amber-600 text-white hover:opacity-90 transition-all"
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => setShowLogin(false)}
                className="w-full text-xs py-1.5" style={{ color: 'var(--text-muted)' }}
              >
                Cancelar
              </button>
            </div>
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
