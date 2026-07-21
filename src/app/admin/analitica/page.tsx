'use client'

import { FaChartLine } from 'react-icons/fa'

export default function AdminAnaliticaPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Analítica
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Visualiza métricas y reportes de la plataforma
        </p>
      </div>
      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <FaChartLine className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Módulo en desarrollo</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Esta funcionalidad estará disponible pronto.</p>
      </div>
    </div>
  )
}