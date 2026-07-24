'use client'

import { Suspense, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ThemeProvider } from '@/context/ThemeContext'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import TrustBar from '@/components/TrustBar'
import HowItWorks from '@/components/HowItWorks'
import Services from '@/components/Services'
import ReservationForm from '@/components/ReservationForm'
import Preloader from '@/components/Preloader'
import PWARegister from '@/components/PWARegister'
import BannerDisplay from '@/components/BannerDisplay'

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

function HomeContent() {
  const [showTerms, setShowTerms] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [formActive, setFormActive] = useState(false)

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
      <main className="relative min-h-screen">
        <Header />
        <Hero />
        <TrustBar />
        <Services />
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
          <ReservationForm onFocusChange={setFormActive} />
        </Suspense>
        <Suspense fallback={<div className="section-container py-16"><div className="skeleton h-32 rounded-2xl" /></div>}>
          <ContactSection />
        </Suspense>
        <Suspense fallback={<div className="skeleton h-48 rounded-none" />}>
          <Footer onTerms={() => setShowTerms(true)} />
        </Suspense>
        <WhatsAppButton hidden={formActive} />
        <ScrollToTop />
        <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
      </main>
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
