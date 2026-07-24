'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { motion } from 'framer-motion'
import {
  FaDog, FaHome, FaHistory, FaSignOutAlt, FaWalking,
} from 'react-icons/fa'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Mis paseos', icon: FaHome, color: '#059669', href: '/paseador' },
  { id: 'historial', label: 'Historial', icon: FaHistory, color: '#3b82f6', href: '/paseador/historial' },
]

export default function PaseadorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [walkerName, setWalkerName] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (snap.exists() && snap.data().role === 'walker') {
        setWalkerName(snap.data().name || user.displayName || 'Paseador')
        setLoading(false)
      } else {
        router.push('/login')
      }
    })
    return unsub
  }, [router])

  const handleLogout = async () => {
    document.cookie = '__session=; path=/; max-age=0'
    await signOut(auth)
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <FaWalking className="text-success-500 text-3xl mx-auto mb-3 animate-pulse" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-10" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
        <div className="section-container h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-success-500 to-success-600 flex items-center justify-center text-white">
              <FaWalking size={16} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Paseador</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{walkerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
              Inicio
            </a>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 hover:text-danger-400"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Cerrar sesión"
            >
              <FaSignOutAlt size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="section-container py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.03] ${active ? 'bg-white/[0.05]' : ''}`}
                    style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    <Icon size={16} style={{ color: item.color }} />
                    {item.label}
                  </a>
                )
              })}
            </nav>
          </aside>

          {/* Content */}
          <main className="lg:col-span-3">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
