'use client'

import { FaUserFriends } from 'react-icons/fa'

export default function ReferirPage() {
  return (
    <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <FaUserFriends className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
      <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Referir amigo</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Comparte PET Ap con tus amigos y gana recompensas por cada referido.
      </p>
      <a href="/#reservar" className="btn-primary inline-flex text-xs">Reservar un paseo</a>
    </div>
  )
}
