'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { clearSessionCookie, loginPathWithRedirect } from '@/lib/auth'
import { getCustomerProfile } from '@/lib/customerProfile'
import { getFamilyOnboardingStep, loadFamilyOnboardingSnapshot } from '@/lib/familyOnboarding'
import { useSessionRole } from '@/lib/useSessionRole'
import { ROLES, ROLE_HOME } from '@/lib/roles'
import AppShell from '@/components/layout/AppShell'
import AnnouncementBanner from '@/components/AnnouncementBanner'
import { Button, Card, EmptyState, ErrorState } from '@/components/ui'
import {
  Dog, Calendar, PawPrint, Camera, Users, MapPin,
  Settings, Gift, Home, History, BookOpen, Bell, ShieldCheck,
} from 'lucide-react'

const ACCOUNT_ITEMS = [
  { id: 'dashboard', label: 'Inicio', icon: Home, color: '#D97706', href: '/familia' },
  { id: 'nueva-reserva', label: 'Nueva reserva', icon: Calendar, color: '#059669', href: '/familia/nueva-reserva' },
  { id: 'perros', label: 'Mis perros', icon: PawPrint, color: '#3b82f6', href: '/familia/perros' },
  { id: 'direcciones', label: 'Mis direcciones', icon: MapPin, color: '#F97316', href: '/familia/direcciones' },
  { id: 'historial', label: 'Mi historial', icon: History, color: '#8B5CF6', href: '/familia/historial' },
  { id: 'fotos', label: 'Fotos de paseos', icon: Camera, color: '#06B6D4', href: '/familia/fotos' },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, color: '#D97706', href: '/familia/notificaciones' },
  { id: 'billetera', label: 'Créditos PET', icon: Dog, color: '#0F766E', href: '/familia/billetera' },
  { id: 'referir', label: 'Referir amigo', icon: Users, color: '#EC4899', href: '/familia/referir' },
  { id: 'lealtad', label: 'Mi lealtad', icon: Gift, color: '#F59E0B', href: '/familia/lealtad' },
  { id: 'ayuda', label: 'Centro de ayuda', icon: BookOpen, color: '#64748B', href: '/familia/ayuda' },
  { id: 'config', label: 'Configuración', icon: Settings, color: '#64748B', href: '/familia/config' },
  { id: 'privacidad', label: 'Privacidad y ARCO', icon: ShieldCheck, color: '#0F766E', href: '/familia/privacidad' },
]

export default function FamilyLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [, setUid] = useState('')
  const [accessError, setAccessError] = useState('')

  const session = useSessionRole([ROLES.CUSTOMER])
  const { status, uid } = session

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'no-session') {
      clearSessionCookie()
      router.replace(loginPathWithRedirect(pathname))
      return
    }
    if (status === 'denied') {
      router.replace(ROLE_HOME[session.role])
      return
    }
    if (status === 'error') {
      setAccessError('No pudimos verificar tu sesión. Revisa tu conexión e intenta nuevamente.')
      setLoading(false)
      return
    }
    if (status === 'ready' && uid) {
      setUid(uid)
      ;(async () => {
        try {
          const profile = await getCustomerProfile(uid)
          setUserName(profile?.name || auth.currentUser?.displayName || 'Familia')
          if (pathname !== '/familia/configuracion-inicial') {
            const onboarding = await loadFamilyOnboardingSnapshot(uid)
            if (getFamilyOnboardingStep(onboarding) !== 'complete') {
              router.replace('/familia/configuracion-inicial')
              return
            }
          }
          setAccessError('')
          setLoading(false)
        } catch {
          setAccessError('No pudimos cargar tu perfil. Revisa tu conexión e intenta nuevamente.')
          setLoading(false)
        }
      })()
    }
  }, [status, uid, router, pathname, session.role])

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

  if (accessError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm p-6">
          <ErrorState description={accessError} onRetry={() => void session.refresh()} />
        </Card>
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
      mobileNavigation
      showLogoutLabel
    >
      <AnnouncementBanner />
      {children || (
        <Card className="p-8">
          <EmptyState
            icon={<Dog size={28} />}
            title={`Bienvenido, ${userName}`}
            description="Selecciona una opción del menú para comenzar."
            action={<Button onClick={() => router.push('/familia/nueva-reserva')}>Solicitar paseo</Button>}
          />
        </Card>
      )}
    </AppShell>
  )
}
