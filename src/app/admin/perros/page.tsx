'use client'

import dynamic from 'next/dynamic'
import PanelFallback from '@/components/layout/PanelFallback'

// El panel llega aparte: así el SDK de Firestore no bloquea la primera pintura.
const AdminPerrosPanel = dynamic(() => import('./AdminPerrosPanel'), {
  ssr: false,
  loading: () => <PanelFallback />,
})

export default function Page() {
  return <AdminPerrosPanel />
}
