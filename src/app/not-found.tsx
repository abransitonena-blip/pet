'use client'
import Link from 'next/link'
import { FaDog, FaPaw } from 'react-icons/fa'
import Button from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center max-w-md">
        <div className="text-8xl mb-6 opacity-20">🐾</div>
        <h1 className="text-6xl font-bold gradient-text mb-4">404</h1>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Página no encontrada</h2>
        <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          Parece que esta página se fue a pasear y no volvió. Mejor regresa al inicio.
        </p>
        <Link href="/" className="inline-flex">
          <Button icon={<FaDog />}>Volver al inicio</Button>
        </Link>
        <div className="mt-12 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <FaPaw /> PET Ap <FaPaw />
        </div>
      </div>
    </div>
  )
}
