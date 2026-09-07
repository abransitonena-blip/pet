'use client'

/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useConfig } from '@/context/ConfigContext'
import { isAuthPath } from '@/lib/consentPaths'

export const CONSENT_KEY = 'petap_consent_v1'

function getGaId() {
  return process.env.NEXT_PUBLIC_GA_ID || ''
}

export type ConsentChoice = 'granted' | 'denied'

interface ConsentContextValue {
  consent: ConsentChoice | null
  setConsent: (choice: ConsentChoice) => void
  clearConsent: () => void
}

const ConsentContext = createContext<ConsentContextValue>({
  consent: null,
  setConsent: () => {},
  clearConsent: () => {},
})

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
  const gaId = getGaId()
  if (typeof window === 'undefined' || !gaId || getStoredConsent() !== 'granted') return false
  initDataLayer()
  const w = window as unknown as { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void; __petAnalyticsEnabled?: boolean }
  w.__petAnalyticsEnabled = true

  if (!document.getElementById('gtag-js')) {
    const script = document.createElement('script')
    script.id = 'gtag-js'
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
    document.head.appendChild(script)
  }

  w.gtag?.('js', new Date())
  w.gtag?.('config', gaId, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })
  return true
}

function removeAnalyticsCookies() {
  if (typeof document === 'undefined') return
  for (const rawCookie of document.cookie.split(';')) {
    const name = rawCookie.split('=')[0]?.trim()
    if (!name || (name !== '_ga' && !name.startsWith('_ga_'))) continue
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
    if (typeof location !== 'undefined' && location.hostname) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}; SameSite=Lax`
    }
  }
}

export function disableAnalytics() {
  if (typeof window === 'undefined') return
  const w = window as unknown as { __petAnalyticsEnabled?: boolean }
  w.__petAnalyticsEnabled = false
  document.getElementById('gtag-js')?.remove()
  document.getElementById('gtag-config')?.remove()
  removeAnalyticsCookies()
}

function getStoredConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(CONSENT_KEY)
  return value === 'granted' ? 'granted' : value === 'denied' ? 'denied' : null
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ConsentChoice | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)
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
    const enabled = config.analyticsEnabled === true && !isAuthPath(pathname)
    if (consent === 'granted' && enabled) {
      loadAnalytics()
    } else {
      disableAnalytics()
    }
  }, [consent, pathname, config.analyticsEnabled])

  const setConsent = useCallback((choice: ConsentChoice) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice)
    } catch {
      // storage unavailable — consent applies for the session
    }
    consentCommand('update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: choice,
    })
    if (choice === 'denied') disableAnalytics()
    setConsentState(choice)
  }, [])

  const clearConsent = useCallback(() => {
    try { window.localStorage.removeItem(CONSENT_KEY) } catch { /* preference storage unavailable */ }
    consentCommand('update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    })
    disableAnalytics()
    setConsentState(null)
    setShowPreferences(false)
  }, [])

  return (
    <ConsentContext.Provider value={{ consent, setConsent, clearConsent }}>
      {children}
      {consent === null && !isAuthPath(pathname) && <ConsentBanner />}
      {consent !== null && !isAuthPath(pathname) && (
        <div className="fixed bottom-3 left-3 z-[var(--z-sticky)]">
          {showPreferences ? (
            <div className="w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border p-4 shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Preferencias de analítica</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Estado: {consent === 'granted' ? 'analítica aceptada' : 'analítica rechazada'}. La publicidad permanece denegada.</p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button className="btn btn-secondary min-h-11 text-xs" onClick={() => setConsent('denied')}>Rechazar</button>
                <button className="btn btn-secondary min-h-11 text-xs" onClick={() => setConsent('granted')}>Aceptar analítica</button>
                <button className="btn btn-secondary min-h-11 text-xs" onClick={clearConsent}>Borrar elección</button>
              </div>
              <button className="mt-2 min-h-11 w-full text-xs underline" onClick={() => setShowPreferences(false)}>Cerrar preferencias</button>
            </div>
          ) : (
            <button className="btn btn-secondary min-h-11 text-xs" onClick={() => setShowPreferences(true)}>Privacidad</button>
          )}
        </div>
      )}
    </ConsentContext.Provider>
  )
}

function ConsentBanner() {
  const { setConsent } = useConsent()
  return (
    <div
      role="dialog"
      aria-label="Preferencias de cookies y analítica"
      className="fixed bottom-0 inset-x-0 z-[var(--z-overlay)] p-3"
    >
      <div
        className="max-w-3xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-panel, 24px)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <p className="flex-1 min-w-0 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Usamos Google Analytics para entender cómo mejorar el sitio. No vendemos tus datos.{' '}
          <Link
            href="/privacidad"
            className="font-semibold underline underline-offset-2"
            style={{ color: 'var(--color-primary)' }}
          >
            Más información
          </Link>
        </p>
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <button
            onClick={() => setConsent('denied')}
            className="btn btn-secondary min-h-11 text-sm px-4"
          >
            Rechazar
          </button>
          <button
            onClick={() => setConsent('granted')}
            className="btn btn-secondary min-h-11 text-sm px-4"
          >
            Aceptar analítica
          </button>
        </div>
      </div>
    </div>
  )
}

export function useConsent() {
  return useContext(ConsentContext)
}
