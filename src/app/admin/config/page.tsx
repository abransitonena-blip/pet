'use client'

import AdminConfig from '@/components/AdminConfig'
import BackupStatus from '@/components/admin/BackupStatus'
import PageHeader from '@/components/ui/PageHeader'

export default function AdminConfigPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Ajusta la configuración general del sitio y servicios"
      />
      <BackupStatus />
      <AdminConfig />
    </div>
  )
}
