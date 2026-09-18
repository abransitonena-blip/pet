'use client'

import dynamic from 'next/dynamic'
import PanelFallback from '@/components/layout/PanelFallback'

const WalkerLayoutClient = dynamic(() => import('./WalkerLayoutClient'), {
  ssr: false,
  loading: () => <PanelFallback />,
})

export default function LazyWalkerLayout({ children }: { children: React.ReactNode }) {
  return <WalkerLayoutClient>{children}</WalkerLayoutClient>
}
