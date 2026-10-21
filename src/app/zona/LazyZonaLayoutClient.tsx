'use client'

import dynamic from 'next/dynamic'
import PanelFallback from '@/components/layout/PanelFallback'

// El armazón del panel -- menú, sesión y avisos -- también trae Firestore
// consigo, así que llega aparte de la primera pintura.
const ZonaLayoutClient = dynamic(() => import('./ZonaLayoutClient'), {
  ssr: false,
  loading: () => <PanelFallback />,
})

export default function LazyZonaLayoutClient({ children }: { children: React.ReactNode }) {
  return <ZonaLayoutClient>{children}</ZonaLayoutClient>
}
