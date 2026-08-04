'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useConfig } from '@/context/ConfigContext'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-HQTMCZX66M'
const CONSENT_KEY = 'petap_consent_v1'
const AUTH_PATHS = ['/login', '/admin', '/paseador', '/familia', '/mi-cuenta']

export type ConsentChoice = 'granted' | 'denied'

interface ConsentContextValue {
  consent: ConsentChoice | null
  setConsent: (choice: ConsentChoice) => void
}

const ConsentContext = createContext<ConsentContextValue>({
  consent: null,
  setConsent: () => {},
})

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function initDataLayer() {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void }
  w.dataLayer = w.dataLayer || []
  w.gtag = w.gtag || function (...args: unknown[]) { w.dataLayer.push(args) }
}

function consentCommand(command: string, params: Record<string, string>) {
  initDataLayer()
  const w = window as unknown as { dataLayer: unknown[] }
  w.dataLayer.push(['consent', command, params])
}

export function loadAnalytics() {
  if (typeof window === 'undefined') return
  initDataLayer()
  const w = window as unknown as { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void }

  if (!document.getElementById('gtag-js')) {
    const script = document.createElement('script')
    script.id = 'gtag-js'
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    document.head.appendChild(script)
  }

  const existing = document.getElementById('gtag-config')
  if (existing) existing.remove()
  const inline = document.createElement('script')
  inline.id = 'gtag-config'
  inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});`
  document.head.appendChild(inline)

  w.gtag?.('js', new Date())
  w.gtag?.('config', GA_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })
}

function getStoredConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(CONSENT_KEY)
  return value === 'granted' ? 'granted' : value === 'denied' ? 'denied' : null
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ConsentChoice | null>(null)
  const pathname = usePathname()
  const { config } = useConfig()

  useEffect(() => {
    setConsentState(getStoredConsent())
  }, [])

  useEffect(() => {
    initDataLayer()
    consentCommand('default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: consent === 'granted' ? 'granted' : 'denied',
    })
  }, [consent])

  useEffect(() => {
    const enabled = config.analyticsEnabled !== false && !isAuthPath(pathname)
    if (consent === 'granted' && enabled) {
      loadAnalytics()
    }
  }, [consent, pathname, config.analyticsEnabled])

  const setConsent = useCallback((choice: ConsentChoice) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice)
    } catch {
      // storage unavailable — consent applies for the session
    }
    consentCommand('update', {
      ad_storage: choice,
      ad_user_data: choice,
      ad_personalization: choice,
      analytics_storage: choice,
    })
    setConsentState(choice)
  }, [])

  return (
    <ConsentContext.Provider value={{ consent, setConsent }}>
      {children}
      {consent === null && !isAuthPath(pathname) && <ConsentBanner />}
    </ConsentContext.Provider>
  )
}

function ConsentBanner() {
  const { setConsent } = useConsent()
  return (
    <div
      role="dialog"
      aria-label="Preferencias de cookies y analítica"
      className="fixed bottom-0 inset-x-0 z-[var(--z-overlay)] p-4"
    >
      <div className="card max-w-2xl mx-auto p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">Tu privacidad importa</p>
          <p className="text-xs text-muted mt-0.5">
            Usamos analítica (Google) únicamente para entender cómo mejorar el sitio. Puedes aceptar o rechazarla. No vendemos tus datos.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setConsent('denied')}
            className="btn-secondary text-sm px-4 py-2"
          >
            Rechazar
          </button>
          <button
            onClick={() => setConsent('granted')}
            className="btn-primary text-sm px-4 py-2"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}

export function useConsent() {
  return useContext(ConsentContext)
}
