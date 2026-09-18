'use client'

import dynamic from 'next/dynamic'
import PanelFallback from '@/components/layout/PanelFallback'

// El armazón del panel -- menú, sesión y avisos -- también trae Firestore
// consigo, así que llega aparte de la primera pintura.
const AdminLayoutClient = dynamic(() => import('./AdminLayoutClient'), {
  ssr: false,
  loading: () => <PanelFallback />,
})

export default function LazyAdminLayoutClient({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
