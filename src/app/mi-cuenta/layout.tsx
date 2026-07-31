'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { clearSessionCookie } from '@/lib/auth'
import { motion } from 'framer-motion'
import {
  Dog, Calendar, PawPrint, Camera, Users, MapPin,
  LogOut, Settings, Gift, Home, History, BookOpen, Bell,
} from 'lucide-react'
import NotificationBell from '@/components/NotificationBell'

const ACCOUNT_ITEMS = [
  { id: 'dashboard', label: 'Inicio', icon: Home, color: '#D97706', href: '/mi-cuenta' },
  { id: 'nueva-reserva', label: 'Nueva reserva', icon: Calendar, color: '#059669', href: '/mi-cuenta/nueva-reserva' },
  { id: 'perros', label: 'Mis perros', icon: PawPrint, color: '#3b82f6', href: '/mi-cuenta/perros' },
  { id: 'direcciones', label: 'Mis direcciones', icon: MapPin, color: '#F97316', href: '/mi-cuenta/direcciones' },
  { id: 'historial', label: 'Mi historial', icon: History, color: '#8B5CF6', href: '/mi-cuenta/historial' },
  { id: 'fotos', label: 'Fotos de paseos', icon: Camera, color: '#06B6D4', href: '/mi-cuenta/fotos' },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, color: '#D97706', href: '/mi-cuenta/notificaciones' },
  { id: 'billetera', label: 'Billetera', icon: Dog, color: '#0F766E', href: '/mi-cuenta/billetera' },
  { id: 'referir', label: 'Referir amigo', icon: Users, color: '#EC4899', href: '/mi-cuenta/referir' },
  { id: 'lealtad', label: 'Mi lealtad', icon: Gift, color: '#F59E0B', href: '/mi-cuenta/lealtad' },
  { id: 'ayuda', label: 'Centro de ayuda', icon: BookOpen, color: '#64748B', href: '/mi-cuenta/ayuda' },
  { id: 'config', label: 'Configuración', icon: Settings, color: '#64748B', href: '/mi-cuenta/config' },
]

export default function MiCuentaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
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
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-10" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
        <div className="section-container h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white">
              <Dog size={16} />
            </Link>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Mi cuenta</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
              Inicio
            </Link>
            {uid && <NotificationBell uid={uid} />}
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

      <div className="section-container py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <nav className="space-y-1">
              {ACCOUNT_ITEMS.map((item) => {
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
          <div className="lg:col-span-3">
            {children || (
              <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <Dog className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Bienvenido, {userName}
                </h2>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  Selecciona una opción del menú para comenzar.
                </p>
                <Link href="/mi-cuenta/nueva-reserva" className="btn-primary inline-flex">
                  Reservar un paseo
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
