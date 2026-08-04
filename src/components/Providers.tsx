'use client'

import { ReactNode } from 'react'
import { PricesProvider } from '@/context/PricesContext'
import { ConfigProvider } from '@/context/ConfigContext'
import { ToastProvider } from '@/context/ToastContext'
import { ConsentProvider } from '@/components/analytics/ConsentProvider'

export default function Providers({ children }: { children: ReactNode }) {
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
