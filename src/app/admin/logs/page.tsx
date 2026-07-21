'use client'

import { FaClipboardList } from 'react-icons/fa'

export default function AdminLogsPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Logs de Auditoría
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Revisa el historial de acciones y eventos del sistema
        </p>
      </div>
      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <FaClipboardList className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Módulo en desarrollo</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Esta funcionalidad estará disponible pronto.</p>
      </div>
    </div>
  )
}