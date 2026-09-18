'use client'

import dynamic from 'next/dynamic'
import PanelFallback from '@/components/layout/PanelFallback'

// Llega aparte: su código trae el SDK de Firestore y no debe bloquear la
// primera pintura.
const AdminTicketsList = dynamic(() => import('@/components/admin/AdminTicketsList'), {
  ssr: false,
  loading: () => <PanelFallback />,
})

export default function LazyTicketsList() {
  return <AdminTicketsList />
}
