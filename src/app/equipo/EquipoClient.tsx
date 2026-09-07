'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Logo } from '@/components/ui/Logo'
import TeamLoginForm from '@/components/TeamLoginForm'

export default function EquipoClient() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="mx-auto block mb-4 w-fit" aria-label="Logo PET Ap">
            <Logo size={56} rounded="rounded-2xl" className="shadow-glow" />
          </Link>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Acceso al equipo PET
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Administración, paseadores y supervisores
          </p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <TeamLoginForm />
        </div>

        <p className="text-center mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-primary"
            style={{ color: 'var(--text-muted)' }}
          >
            ¿Familia PET? Entra desde aquí →
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
