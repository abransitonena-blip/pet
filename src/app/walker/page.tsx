'use client'

import dynamic from 'next/dynamic'
import PanelFallback from '@/components/layout/PanelFallback'

// El panel se pide aparte para que el SDK de Firestore no bloquee la primera
// pintura: ver PanelFallback.
const WalkerDashboard = dynamic(() => import('./WalkerDashboard'), {
  ssr: false,
  loading: () => <PanelFallback />,
})

export default function WalkerPage() {
  return <WalkerDashboard />
}
