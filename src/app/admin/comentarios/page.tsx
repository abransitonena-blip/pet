import type { Metadata } from 'next'
import LazyFeedbackPanel from './LazyFeedbackPanel'
import PageHeader from '@/components/ui/PageHeader'

export const metadata: Metadata = {
  title: 'Comentarios de familias | PET Ap',
  robots: { index: false, follow: false },
}

export default function AdminFeedbackPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Comentarios de familias" description="Mensajes privados enviados desde el centro de ayuda de Familia PET." />
      <LazyFeedbackPanel />
    </div>
  )
}
