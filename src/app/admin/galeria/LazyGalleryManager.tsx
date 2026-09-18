'use client'

import dynamic from 'next/dynamic'
import PanelFallback from '@/components/layout/PanelFallback'

// Llega aparte: su código trae el SDK de Firestore y no debe bloquear la
// primera pintura.
const AdminGalleryManager = dynamic(() => import('@/components/gallery/AdminGalleryManager'), {
  ssr: false,
  loading: () => <PanelFallback />,
})

export default function LazyGalleryManager() {
  return <AdminGalleryManager />
}
