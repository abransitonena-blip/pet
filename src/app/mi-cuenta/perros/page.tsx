'use client'

import { FaPaw } from 'react-icons/fa'

export default function MisPerrosPage() {
  return (
    <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <FaPaw className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
      <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Mis perros</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Próximamente podrás registrar y gestionar tus mascotas aquí.
      </p>
      <a href="/#reservar" className="btn-primary inline-flex text-xs">Reservar un paseo</a>
    </div>
  )
}
