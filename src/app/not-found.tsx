'use client'
import Link from 'next/link'
import { FaDog, FaPaw } from 'react-icons/fa'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center max-w-md">
        <div className="text-8xl mb-6 opacity-20">🐾</div>
        <h1 className="text-6xl font-bold gradient-text mb-4">404</h1>
        <h2 className="text-xl text-white font-semibold mb-2">Página no encontrada</h2>
        <p className="text-white/50 text-sm mb-8">
          Parece que esta página se fue a pasear y no volvió. Mejor regresa al inicio.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-amber-600 text-white font-semibold hover:opacity-90 transition-all"
        >
          <FaDog /> Volver al inicio
        </Link>
        <div className="mt-12 flex items-center justify-center gap-2 text-white/20 text-xs">
          <FaPaw /> Paseos Quebrada <FaPaw />
        </div>
      </div>
    </div>
  )
}
