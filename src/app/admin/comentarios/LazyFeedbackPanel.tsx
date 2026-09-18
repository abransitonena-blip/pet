'use client'

import dynamic from 'next/dynamic'
import PanelFallback from '@/components/layout/PanelFallback'

// Llega aparte: su código trae el SDK de Firestore y no debe bloquear la
// primera pintura.
const FeedbackPanel = dynamic(() => import('@/components/admin/FeedbackPanel'), {
  ssr: false,
  loading: () => <PanelFallback />,
})

export default function LazyFeedbackPanel() {
  return <FeedbackPanel />
}
