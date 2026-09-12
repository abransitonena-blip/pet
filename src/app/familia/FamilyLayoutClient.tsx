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
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import AppShell from '@/components/layout/AppShell'
import { useUnreadOwnChat } from '@/lib/useUnreadChat'
import AnnouncementBanner from '@/components/AnnouncementBanner'
import { Button, Card, EmptyState, ErrorState } from '@/components/ui'
import {
  Dog, Calendar, PawPrint, Camera, Users, MapPin, Wallet,
  Settings, Gift, Home, History, BookOpen, Bell, ShieldCheck, MessagesSquare,
} from 'lucide-react'

/**
 * Fourteen destinations in one flat list read as a wall. They are grouped by
 * what a family comes to do, with the walk itself first: book, follow, see the
 * photos. Every destination is the same as before; only order and headings.
 */
const ACCOUNT_ITEMS = [
  { id: 'dashboard', label: 'Inicio', icon: Home, href: '/familia', group: 'Paseos' },
  { id: 'nueva-reserva', label: 'Nueva reserva', icon: Calendar, href: '/familia/nueva-reserva', group: 'Paseos' },
  { id: 'historial', label: 'Mi historial', icon: History, href: '/familia/historial', group: 'Paseos' },
  { id: 'fotos', label: 'Fotos y reportes', icon: Camera, href: '/familia/fotos', group: 'Paseos' },
  { id: 'perros', label: 'Mis perros', icon: PawPrint, href: '/familia/perros', group: 'Mi familia' },
  { id: 'direcciones', label: 'Mis direcciones', icon: MapPin, href: '/familia/direcciones', group: 'Mi familia' },
  { id: 'billetera', label: 'Créditos PET', icon: Wallet, href: '/familia/billetera', group: 'Beneficios' },
  { id: 'lealtad', label: 'Mi lealtad', icon: Gift, href: '/familia/lealtad', group: 'Beneficios' },
  { id: 'referir', label: 'Referir amigo', icon: Users, href: '/familia/referir', group: 'Beneficios' },
  { id: 'mensajes', label: 'Mensajes', icon: MessagesSquare, href: '/familia/mensajes', group: 'Cuenta' },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, href: '/familia/notificaciones', group: 'Cuenta' },
  { id: 'ayuda', label: 'Centro de ayuda', icon: BookOpen, href: '/familia/ayuda', group: 'Cuenta' },
  { id: 'config', label: 'Configuración', icon: Settings, href: '/familia/config', group: 'Cuenta' },
  { id: 'privacidad', label: 'Privacidad y ARCO', icon: ShieldCheck, href: '/familia/privacidad', group: 'Cuenta' },
]
// Créditos y lealtad no tienen forma de moverse: nada escribe esos saldos
// mientras sus banderas están apagadas. El menú no manda a la familia a un cero
// que nunca cambia; al encender la bandera, la entrada vuelve sola.
  .filter((item) => {
    if (item.id === 'billetera') return FEATURE_FLAGS.WALLET_MUTATIONS_ENABLED
    if (item.id === 'lealtad') return FEATURE_FLAGS.LOYALTY_REDEMPTION_ENABLED
    return true
  })

export default function FamilyLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [, setUid] = useState('')
  const [accessError, setAccessError] = useState('')

  const session = useSessionRole([ROLES.CUSTOMER])
  const { status, uid } = session
  // El menú avisa de los mensajes sin leer: el chat no sirve si hay que abrirlo
  // para descubrir que llegó algo.
  const unreadMessages = useUnreadOwnChat(status === 'ready' && uid ? uid : '')
  const navItems = ACCOUNT_ITEMS.map((item) => (item.id === 'mensajes' ? { ...item, badge: unreadMessages } : item))

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
      navItems={navItems}
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
            title={userName}
            description="Selecciona una opción del menú para comenzar."
            action={<Button onClick={() => router.push('/familia/nueva-reserva')}>Solicitar paseo</Button>}
          />
        </Card>
      )}
    </AppShell>
  )
}
