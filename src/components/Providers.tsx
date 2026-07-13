'use client'

import { ReactNode } from 'react'
import { PricesProvider } from '@/context/PricesContext'
import { ConfigProvider } from '@/context/ConfigContext'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider>
      <PricesProvider>
        {children}
      </PricesProvider>
    </ConfigProvider>
  )
}
