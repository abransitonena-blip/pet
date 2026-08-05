'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { clearSessionCookie } from '@/lib/auth'
import { ReservationsProvider } from '@/context/ReservationsContext'
import {
  Dog, Gauge, Calendar, Users, PawPrint, Footprints,
  MapPin, DollarSign, Tag, Star,
  TrendingUp, Settings, ClipboardList, Bot,
  MessageSquare, Image, Zap, Shield,
} from 'lucide-react'
import AdminShell from '@/components/layout/AdminShell'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge, href: '/admin' },
  { id: 'reservas', label: 'Reservas', icon: Calendar, href: '/admin/reservas' },
  { id: 'clientes', label: 'Clientes', icon: Users, href: '/admin/clientes' },
  { id: 'perros', label: 'Perros', icon: PawPrint, href: '/admin/perros' },
  { id: 'paseadores', label: 'Paseadores', icon: Footprints, href: '/admin/paseadores' },
  { id: 'zonas', label: 'Zonas', icon: MapPin, href: '/admin/zonas' },
  { id: 'rutas', label: 'Rutas', icon: MapPin, href: '/admin/rutas' },
  { id: 'finanzas', label: 'Finanzas', icon: DollarSign, href: '/admin/finanzas' },
  { id: 'cupones', label: 'Cupones', icon: Tag, href: '/admin/cupones' },
  { id: 'referidos', label: 'Referidos', icon: Users, href: '/admin/referidos' },
  { id: 'resenas', label: 'Reseñas', icon: Star, href: '/admin/resenas' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, href: '/admin/chat' },
  { id: 'analitica', label: 'Analítica', icon: TrendingUp, href: '/admin/analitica' },
  { id: 'galeria', label: 'Galería', icon: Image, href: '/admin/galeria' },
  { id: 'pet-ahora', label: 'PET Ahora', icon: Zap, href: '/admin/pet-ahora', color: '#f59e0b' },
  { id: 'supervisores', label: 'Supervisores', icon: Shield, href: '/admin/supervisores', color: '#7c3aed' },
  { id: 'config', label: 'Configuración', icon: Settings, href: '/admin/config' },
  { id: 'logs', label: 'Logs', icon: ClipboardList, href: '/admin/logs' },
  { id: 'ia', label: 'Insights', icon: Bot, href: '/admin/ia' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState<{ commit?: string; environment?: string } | null>(null)

  useEffect(() => {
    fetch('/api/version').then((r) => r.ok && r.json()).then((d) => setVersion(d)).catch(() => {})
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login')
        return
      }
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      const role = userSnap.exists() ? userSnap.data()?.role : null
      const isAdmin = role === 'admin' || role === 'supervisor'
      if (!isAdmin) {
        await signOut(auth)
        router.push('/login')
        return
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
          <Dog className="text-brand-500 text-3xl mx-auto mb-3 animate-pulse" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando centro de operaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <ReservationsProvider>
      <AdminShell navItems={NAV_ITEMS} onLogout={handleLogout} version={version}>
        {children}
      </AdminShell>
    </ReservationsProvider>
  )
}
