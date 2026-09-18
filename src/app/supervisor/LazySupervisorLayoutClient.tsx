'use client'

import dynamic from 'next/dynamic'
import PanelFallback from '@/components/layout/PanelFallback'

// El armazón del panel -- menú, sesión y avisos -- también trae Firestore
// consigo, así que llega aparte de la primera pintura.
const SupervisorLayoutClient = dynamic(() => import('./SupervisorLayoutClient'), {
  ssr: false,
  loading: () => <PanelFallback />,
})

export default function LazySupervisorLayoutClient({ children }: { children: React.ReactNode }) {
  return <SupervisorLayoutClient>{children}</SupervisorLayoutClient>
}
