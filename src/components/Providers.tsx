'use client'

import { ReactNode } from 'react'
import { PricesProvider } from '@/context/PricesContext'
import { ConfigProvider } from '@/context/ConfigContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/context/ToastContext'
import { ConsentProvider } from '@/components/analytics/ConsentProvider'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ConfigProvider>
        <PricesProvider>
          <ToastProvider>
            <ConsentProvider>
              {children}
            </ConsentProvider>
          </ToastProvider>
        </PricesProvider>
      </ConfigProvider>
    </ThemeProvider>
  )
}
