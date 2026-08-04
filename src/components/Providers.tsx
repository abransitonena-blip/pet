'use client'

import { ReactNode, useEffect, useState } from 'react'
import { PricesProvider } from '@/context/PricesContext'
import { ConfigProvider } from '@/context/ConfigContext'
import { ToastProvider } from '@/context/ToastContext'
import { ConsentProvider } from '@/components/analytics/ConsentProvider'

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
    <ConfigProvider>
      <PricesProvider>
        <ToastProvider>
          <ConsentProvider>
            {children}
          </ConsentProvider>
        </ToastProvider>
      </PricesProvider>
    </ConfigProvider>
  )
}
