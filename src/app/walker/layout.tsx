'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { clearSessionCookie } from '@/lib/auth'
import AppShell from '@/components/layout/AppShell'
import WalkerHeartbeat from '@/components/WalkerHeartbeat'
import {
  Home, History, LogOut, Dog, AlertTriangle,
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Mis paseos', icon: Home, color: '#059669', href: '/walker' },
  { id: 'historial', label: 'Historial', icon: History, color: '#3b82f6', href: '/walker/historial' },
  { id: 'perfil', label: 'Mi perfil', icon: Dog, color: '#D97706', href: '/walker/perfil' },
]

export default function PaseadorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [walkerName, setWalkerName] = useState('')
  const [error, setError] = useState('')
  const [mustChangePassword, setMustChangePassword] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }

      const userSnap = await getDoc(doc(db, 'users', user.uid))
      if (!userSnap.exists() || userSnap.data().role !== 'walker') {
        setError('No tienes acceso de paseador')
        setLoading(false)
        return
      }

      const name = userSnap.data().name || user.displayName || 'Paseador'
      setWalkerName(name)

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
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white mx-auto mb-3">
            <Dog size={20} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando panel...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="rounded-2xl p-8 text-center max-w-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="w-11 h-11 rounded-xl bg-danger-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={20} className="text-danger-400" />
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
    <AppShell
      navItems={NAV_ITEMS}
      userName={walkerName}
      userRole="Paseador"
      onLogout={handleLogout}
      logoHref="/"
      mustChangePassword={mustChangePassword}
      headerExtra={<WalkerHeartbeat />}
    >
      {children}
    </AppShell>
  )
}