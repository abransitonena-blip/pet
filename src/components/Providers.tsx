'use client'

import { ReactNode } from 'react'
import { PricesProvider } from '@/context/PricesContext'
import { ConfigProvider } from '@/context/ConfigContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ReservationsProvider } from '@/context/ReservationsContext'
import { ToastProvider } from '@/context/ToastContext'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ConfigProvider>
        <PricesProvider>
          <ReservationsProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ReservationsProvider>
        </PricesProvider>
      </ConfigProvider>
    </ThemeProvider>
  )
}
