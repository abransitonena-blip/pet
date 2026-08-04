'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { clearSessionCookie } from '@/lib/auth'
import { motion } from 'framer-motion'
import WalkerHeartbeat from '@/components/WalkerHeartbeat'
import { PetAhoraToastProvider } from '@/components/PetAhoraToast'
import {
  Dog, Home, History, LogOut, Footprints, AlertTriangle,
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Mis paseos', icon: Home, color: '#059669', href: '/paseador' },
  { id: 'historial', label: 'Historial', icon: History, color: '#3b82f6', href: '/paseador/historial' },
  { id: 'perfil', label: 'Mi perfil', icon: Dog, color: '#D97706', href: '/paseador/perfil' },
]

export default function PaseadorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [walkerName, setWalkerName] = useState('')
  const [error, setError] = useState('')
  const [mustChangePassword, setMustChangePassword] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }

      // Check users/{uid} for role
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      if (!userSnap.exists() || userSnap.data().role !== 'walker') {
        setError('No tienes acceso de paseador')
        setLoading(false)
        return
      }

      const name = userSnap.data().name || user.displayName || 'Paseador'
      setWalkerName(name)

      // Check walkerProfiles/{uid} for status
      try {
        const profileSnap = await getDoc(doc(db, 'walkerProfiles', user.uid))
        if (profileSnap.exists()) {
          const profile = profileSnap.data()
          if (profile.status === 'suspended') {
            setError('Tu cuenta fue suspendida. Contacta al administrador.')
            setLoading(false)
            return
          }
          if (profile.status === 'invited') {
            setError('Tu cuenta aún no ha sido activada.')
            setLoading(false)
            return
          }
          if (profile.forcePasswordChange) {
            setMustChangePassword(true)
          }
        }
      } catch {
        // walkerProfiles doc might not exist yet — continue with user name
      }

      setLoading(false)
    })
    return unsub
  }, [router])

  const handleLogout = async () => {
    clearSessionCookie()
    await signOut(auth)
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <Footprints className="text-success-500 text-3xl mx-auto mb-3 animate-pulse" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando panel...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="rounded-2xl p-8 text-center max-w-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="w-16 h-16 rounded-2xl bg-danger-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-danger-400" />
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Acceso restringido</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{error}</p>
          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-danger-500/10 text-red-700 hover:bg-danger-500/20 transition-all"
          >
            Cerrar sesión
          </button>
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
              <Footprints size={16} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Paseador</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{walkerName}</p>
              <div className="mt-1"><WalkerHeartbeat /></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
              Inicio
            </a>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 hover:text-danger-400"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {mustChangePassword && (
        <div className="bg-brand-500/10 border-b border-brand-500/20 px-4 py-3">
          <div className="section-container">
            <p className="text-xs font-medium text-brand-600">
              Debes cambiar tu contraseña temporal. Ve a tu perfil para actualizarla.
            </p>
          </div>
        </div>
      )}

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
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-ink/5 ${active ? 'bg-ink/10' : ''}`}
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
          <div className="lg:col-span-3">
            <PetAhoraToastProvider>
              {children}
            </PetAhoraToastProvider>
          </div>
        </div>
      </div>
    </div>
  )
}
