'use client'

import { ReactNode, useEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { PricesProvider } from '@/context/PricesContext'
import { ConfigProvider } from '@/context/ConfigContext'
import { ToastProvider } from '@/context/ToastContext'
import { ConsentProvider } from '@/components/analytics/ConsentProvider'
import { BrandProvider } from '@/context/BrandContext'
import SessionCookieKeeper from '@/components/SessionCookieKeeper'

export default function Providers({ children }: { children: ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion))
    }
  }, [reducedMotion])

  return (
    /*
     * `reducedMotion="user"` es lo que hace que framer-motion obedezca la
     * preferencia del sistema en toda la app.
     *
     * La regla CSS de más abajo en globals.css apaga las transiciones y
     * animaciones declaradas en hojas de estilo, pero no toca a framer-motion:
     * ése anima por JavaScript, escribiendo `transform` en línea cuadro a
     * cuadro, y ninguna regla CSS lo detiene. Eran 36 archivos animando para
     * alguien que pidió que no; esto los cubre a todos sin tocar ninguno.
     */
    <MotionConfig reducedMotion="user">
    <ConfigProvider>
      <BrandProvider>
        <PricesProvider>
          <ToastProvider>
            <ConsentProvider>
              <SessionCookieKeeper />
              {children}
            </ConsentProvider>
          </ToastProvider>
        </PricesProvider>
      </BrandProvider>
    </ConfigProvider>
    </MotionConfig>
  )
}
