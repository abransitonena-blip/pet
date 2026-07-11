'use client'

import { ReactNode } from 'react'
import { PricesProvider } from '@/context/PricesContext'

export default function Providers({ children }: { children: ReactNode }) {
  return <PricesProvider>{children}</PricesProvider>
}
