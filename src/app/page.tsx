'use client'

import { Suspense, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/firebase/config'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import TrustBar from '@/components/TrustBar'
import HowItWorks from '@/components/HowItWorks'
import Services from '@/components/Services'
import Preloader from '@/components/Preloader'
import PWARegister from '@/components/PWARegister'
import BannerDisplay from '@/components/BannerDisplay'
import Link from 'next/link'
import { User, ArrowRight, CalendarCheck } from 'lucide-react'

const Gallery = dynamic(() => import('@/components/Gallery'), {
  loading: () => <div className="section-container py-16"><div className="skeleton h-64 rounded-2xl" /></div>,
})
const Reviews = dynamic(() => import('@/components/Reviews'), {
  loading: () => <div className="section-container py-16"><div className="skeleton h-48 rounded-2xl" /></div>,
})
const FAQ = dynamic(() => import('@/components/FAQ'), {
  loading: () => <div className="section-container py-16"><div className="skeleton h-40 rounded-2xl" /></div>,
})
const ContactSection = dynamic(() => import('@/components/ContactSection'), {
  loading: () => <div className="section-container py-16"><div className="skeleton h-32 rounded-2xl" /></div>,
})
const Footer = dynamic(() => import('@/components/Footer'), {
  loading: () => <div className="skeleton h-48 rounded-none" />,
})
const WhatsAppButton = dynamic(() => import('@/components/WhatsAppButton'), { ssr: false })
const ScrollToTop = dynamic(() => import('@/components/ScrollToTop'), { ssr: false })
const TermsModal = dynamic(() => import('@/components/TermsModal'), { ssr: false })
const ReviewForm = dynamic(() => import('@/components/ReviewForm'), {
  loading: () => <div className="skeleton h-32 rounded-2xl" />,
})
const QuoteForm = dynamic(() => import('@/components/QuoteForm'), {
  loading: () => <div className="section-container py-16"><div className="skeleton h-96 rounded-2xl" /></div>,
})

function HomeContent() {
  const [showTerms, setShowTerms] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [user, setUser] = useState<{ uid: string; displayName: string | null } | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ? { uid: u.uid, displayName: u.displayName } : null))
    return unsub
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href^="#"]')
      if (!link) return
      const href = (link as HTMLAnchorElement).getAttribute('href')
      if (!href || href === '#') return
      e.preventDefault()
      const el = document.querySelector(href)
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 80
        window.scrollTo({ top: y, behavior: 'smooth' })
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return (
    <>
      <PWARegister />
      <BannerDisplay />
      <Preloader onComplete={() => setLoaded(true)} />
      <div className="relative min-h-screen">
        <Header />
        <Hero />
        <TrustBar />
        <Services />
        <Suspense fallback={<div className="section-container py-16"><div className="skeleton h-96 rounded-2xl" /></div>}>
          <QuoteForm />
        </Suspense>
        <HowItWorks />
        <Suspense fallback={<div className="section-container py-16"><div className="skeleton h-64 rounded-2xl" /></div>}>
          <Gallery />
        </Suspense>
        <Suspense fallback={<div className="section-container py-16"><div className="skeleton h-40 rounded-2xl" /></div>}>
          <FAQ />
        </Suspense>
        <Suspense fallback={<div className="section-container py-16"><div className="skeleton h-48 rounded-2xl" /></div>}>
          <Reviews />
        </Suspense>
        <div className="section-container pb-16">
          <div className="max-w-md mx-auto">
            <Suspense fallback={<div className="skeleton h-32 rounded-2xl" />}>
              <ReviewForm />
            </Suspense>
          </div>
        </div>
        <Suspense>
          {user ? (
            <section aria-label="Reservar" id="reservar" className="section-container py-20 sm:py-28">
              <div className="max-w-lg mx-auto text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center card">
                  <User className="text-primary" size={24} />
                </div>
                <h2 className="section-title">Bienvenido de vuelta</h2>
                <p className="section-subtitle mb-6">
                  Ya eres parte de Familia PET. Reserva tu paseo desde tu cuenta.
                </p>
                <Link
                  href="/familia/nueva-reserva"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  Ir a reservar <ArrowRight size={14} />
                </Link>
              </div>
            </section>
          ) : (
            <section aria-label="Reservar" id="reservar" className="section-container py-20 sm:py-28">
              <div className="max-w-lg mx-auto text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center card">
                  <CalendarCheck className="text-primary" size={24} />
                </div>
                <h2 className="section-title">Cotiza y agenda tu paseo</h2>
                <p className="section-subtitle mb-6">
                  Obtén tu precio claro en la cotizador de arriba y confírmalo en minutos por WhatsApp.
                </p>
                <a
                  href="#cotizar"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  Cotizar mi paseo <ArrowRight size={14} />
                </a>
              </div>
            </section>
          )}
        </Suspense>
        <Suspense fallback={<div className="section-container py-16"><div className="skeleton h-32 rounded-2xl" /></div>}>
          <ContactSection />
        </Suspense>
        <Suspense fallback={<div className="skeleton h-48 rounded-none" />}>
          <Footer onTerms={() => setShowTerms(true)} />
        </Suspense>
        <WhatsAppButton />
        <ScrollToTop />
        <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
      </div>
    </>
  )
}

export default function Home() {
  return (
    <HomeContent />
  )
}
