import type { Metadata } from 'next'
import ErrorLogsPanel from '@/components/admin/ErrorLogsPanel'
import PageHeader from '@/components/ui/PageHeader'

export const metadata: Metadata = {
  title: 'Errores de aplicación | PET Ap',
  robots: { index: false, follow: false },
}

export default function AdminErrorsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Errores de aplicación" description="Fallas reportadas desde el navegador de usuarios autenticados." />
      <ErrorLogsPanel />
    </div>
  )
}
