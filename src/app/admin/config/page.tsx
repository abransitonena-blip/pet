'use client'

import AdminConfig from '@/components/AdminConfig'

export default function AdminConfigPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Configuración
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Ajusta la configuración general del sitio y servicios
        </p>
      </div>
      <AdminConfig />
    </div>
  )
}
