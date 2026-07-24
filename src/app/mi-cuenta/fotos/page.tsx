'use client'

import { FaCamera } from 'react-icons/fa'

export default function FotosPage() {
  return (
    <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <FaCamera className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
      <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Fotos de paseos</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Las fotos de los paseos de tu peludo aparecerán aquí.
      </p>
      <a href="/#reservar" className="btn-primary inline-flex text-xs">Reservar un paseo</a>
    </div>
  )
}
