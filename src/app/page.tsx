'use client'

import { useState, useEffect } from 'react'
import { ThemeProvider } from '@/context/ThemeContext'
import { useEscapeKey } from '@/lib/useEscapeKey'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import TrustBar from '@/components/TrustBar'
import HowItWorks from '@/components/HowItWorks'
import Services from '@/components/Services'
import Gallery from '@/components/Gallery'
import Reviews from '@/components/Reviews'
import ReservationForm from '@/components/ReservationForm'
import ReviewForm from '@/components/ReviewForm'
import Footer from '@/components/Footer'
import WhatsAppButton from '@/components/WhatsAppButton'
import Preloader from '@/components/Preloader'
import TermsModal from '@/components/TermsModal'
import FAQ from '@/components/FAQ'
import PWARegister from '@/components/PWARegister'
import ContactSection from '@/components/ContactSection'
import ScrollToTop from '@/components/ScrollToTop'
import BannerDisplay from '@/components/BannerDisplay'

function HomeContent() {
  const [showTerms, setShowTerms] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [formActive, setFormActive] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 600)
    return () => clearTimeout(timer)
  }, [])

  // Smooth scroll for anchor links
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
      {!loaded && <Preloader />}
      <main className="relative min-h-screen">
        <Header />
        <Hero />
        <TrustBar />
        <Services />
        <HowItWorks />
        <Gallery />
        <FAQ />
        <Reviews />
        <div className="section-container pb-16">
          <div className="max-w-md mx-auto">
            <ReviewForm />
          </div>
        </div>
        <ReservationForm onFocusChange={setFormActive} />
        <ContactSection />
        <Footer onTerms={() => setShowTerms(true)} />
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
