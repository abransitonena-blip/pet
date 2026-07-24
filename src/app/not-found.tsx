'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { FaDog, FaPaw } from 'react-icons/fa'
import Button from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="text-8xl mb-6"
        >
          🐾
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-6xl font-bold gradient-text mb-4"
        >
          404
        </motion.h1>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Página no encontrada
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-sm mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          Parece que esta página se fue a pasear y no volvió. Mejor regresa al inicio.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Link href="/" className="inline-flex">
            <Button icon={<FaDog />}>Volver al inicio</Button>
          </Link>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-12 flex items-center justify-center gap-2 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <FaPaw /> PET Ap <FaPaw />
        </motion.div>
      </motion.div>
    </div>
  )
}
