'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { clearSessionCookie } from '@/lib/auth'
import AppShell from '@/components/layout/AppShell'
import NotificationBell from '@/components/NotificationBell'
import {
  Dog, Calendar, PawPrint, Camera, Users, MapPin,
  LogOut, Settings, Gift, Home, History, BookOpen, Bell,
} from 'lucide-react'

const ACCOUNT_ITEMS = [
  { id: 'dashboard', label: 'Inicio', icon: Home, color: '#D97706', href: '/familia' },
  { id: 'nueva-reserva', label: 'Nueva reserva', icon: Calendar, color: '#059669', href: '/familia/nueva-reserva' },
  { id: 'perros', label: 'Mis perros', icon: PawPrint, color: '#3b82f6', href: '/familia/perros' },
  { id: 'direcciones', label: 'Mis direcciones', icon: MapPin, color: '#F97316', href: '/familia/direcciones' },
  { id: 'historial', label: 'Mi historial', icon: History, color: '#8B5CF6', href: '/familia/historial' },
  { id: 'fotos', label: 'Fotos de paseos', icon: Camera, color: '#06B6D4', href: '/familia/fotos' },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, color: '#D97706', href: '/familia/notificaciones' },
  { id: 'billetera', label: 'Billetera', icon: Dog, color: '#0F766E', href: '/familia/billetera' },
  { id: 'referir', label: 'Referir amigo', icon: Users, color: '#EC4899', href: '/familia/referir' },
  { id: 'lealtad', label: 'Mi lealtad', icon: Gift, color: '#F59E0B', href: '/familia/lealtad' },
  { id: 'ayuda', label: 'Centro de ayuda', icon: BookOpen, color: '#64748B', href: '/familia/ayuda' },
  { id: 'config', label: 'Configuración', icon: Settings, color: '#64748B', href: '/familia/config' },
]

export default function MiCuentaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [uid, setUid] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login')
        return
      }
      setUid(user.uid)
      const snap = await getDoc(doc(db, 'clients', user.uid))
      if (snap.exists()) {
        setUserName(snap.data().name || user.displayName || 'Familia')
        setLoading(false)
      } else {
        router.push('/login')
      }
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
          <Dog className="text-brand-500 text-3xl mx-auto mb-3 animate-pulse" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando tu cuenta...</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell
      navItems={ACCOUNT_ITEMS}
      userName={userName}
      userRole="Familia PET"
      onLogout={handleLogout}
      logoHref="/"
    >
      {children || (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <Dog className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Bienvenido, {userName}
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Selecciona una opción del menú para comenzar.
          </p>
          <a href="/familia/nueva-reserva" className="btn-primary inline-flex">
            Solicitar paseo
          </a>
        </div>
      )}
    </AppShell>
  )
}