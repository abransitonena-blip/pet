'use client'

import AdminConfig from '@/components/AdminConfig'
import PageHeader from '@/components/ui/PageHeader'

export default function AdminConfigPage() {
  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Ajusta la configuración general del sitio y servicios"
      />
      <AdminConfig />
    </div>
  )
}
