'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { accessPathWithRedirect, clearSessionCookie } from '@/lib/auth'
import { useSessionRole } from '@/lib/useSessionRole'
import { ACCESS_MESSAGES, ROLES, ROLE_HOME } from '@/lib/roles'
import {
  Dog, Gauge, Calendar, Users, PawPrint, Footprints,
  MapPin, DollarSign, Tag, Star,
  TrendingUp, Settings, ClipboardList, Bot,
  MessageSquare, Image, Zap, Printer, Ticket, FlaskConical, AlertOctagon, MessageSquareHeart,
} from 'lucide-react'
import AdminShell from '@/components/layout/AdminShell'
import GeofenceAlertsBanner from '@/components/admin/GeofenceAlertsBanner'
import { useConfig } from '@/context/ConfigContext'
import { applyPanelPreferences } from '@/lib/adminPanels'
import { useUnreadAdminChats } from '@/lib/useUnreadChat'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Resumen', icon: Gauge, href: '/admin', group: 'General' },
  { id: 'reservas', label: 'Solicitudes y paseos', icon: Calendar, href: '/admin/reservas', group: 'Operación' },
  { id: 'reportes', label: 'Reportes de paseo', icon: ClipboardList, href: '/admin/reportes', group: 'Operación' },
  { id: 'rutas', label: 'Rutas', icon: MapPin, href: '/admin/rutas', group: 'Operación' },
  { id: 'pet-ahora', label: 'PET Ahora', icon: Zap, href: '/admin/pet-ahora', color: '#f59e0b', group: 'Operación' },
  { id: 'clientes', label: 'Familias', icon: Users, href: '/admin/clientes', group: 'Personas' },
  { id: 'perros', label: 'Perros', icon: PawPrint, href: '/admin/perros', group: 'Personas' },
  { id: 'paseadores', label: 'Paseadores', icon: Footprints, href: '/admin/paseadores', group: 'Personas' },
  { id: 'tickets', label: 'Tickets internos', icon: Ticket, href: '/admin/tickets', group: 'Cobros' },
  { id: 'printing-test', label: 'Prueba de impresión', icon: Printer, href: '/admin/printing/test', group: 'Cobros' },
  { id: 'printing-lab', label: 'Laboratorio de impresión', icon: FlaskConical, href: '/admin/printing/lab', group: 'Cobros' },
  { id: 'finanzas', label: 'Finanzas', icon: DollarSign, href: '/admin/finanzas', group: 'Cobros' },
  { id: 'cupones', label: 'Cupones', icon: Tag, href: '/admin/cupones', group: 'Contenido' },
  { id: 'referidos', label: 'Referidos', icon: Users, href: '/admin/referidos', group: 'Contenido' },
  { id: 'resenas', label: 'Reseñas', icon: Star, href: '/admin/resenas', group: 'Contenido' },
  { id: 'comentarios', label: 'Comentarios de familias', icon: MessageSquareHeart, href: '/admin/comentarios', group: 'Contenido' },
  { id: 'galeria', label: 'Galería', icon: Image, href: '/admin/galeria', group: 'Contenido' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, href: '/admin/chat', group: 'Contenido' },
  { id: 'zonas', label: 'Zonas', icon: MapPin, href: '/admin/zonas', group: 'Configuración' },
  { id: 'config', label: 'Configuración', icon: Settings, href: '/admin/config', group: 'Configuración' },
  { id: 'analitica', label: 'Analítica', icon: TrendingUp, href: '/admin/analitica', group: 'Sistema' },
  { id: 'logs', label: 'Logs', icon: ClipboardList, href: '/admin/logs', group: 'Sistema' },
  { id: 'errores', label: 'Errores de aplicación', icon: AlertOctagon, href: '/admin/errores', group: 'Sistema' },
  { id: 'ia', label: 'Insights', icon: Bot, href: '/admin/ia', group: 'Sistema' },
]

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState<{ commit?: string; environment?: string } | null>(null)
  const [accessError, setAccessError] = useState('')

  useEffect(() => {
    fetch('/api/version').then((r) => r.ok && r.json()).then((d) => setVersion(d)).catch(() => {})
  }, [])

  const { config } = useConfig()
  const session = useSessionRole([ROLES.ADMIN, ROLES.SUPERVISOR])
  const unreadChats = useUnreadAdminChats(session.status === 'ready')
  const { status } = session

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'no-session') {
      clearSessionCookie()
      router.replace(accessPathWithRedirect(pathname))
      return
    }
    if (status === 'denied') {
      router.replace(ROLE_HOME[session.role])
      return
    }
    if (status === 'missing-claim' || status === 'profile-missing' || status === 'suspended' || status === 'invited' || status === 'inactive' || status === 'error') {
      const messages = {
        'missing-claim': ACCESS_MESSAGES.missingClaim,
        'profile-missing': ACCESS_MESSAGES.walkerProfileMissing,
        suspended: ACCESS_MESSAGES.suspended,
        invited: ACCESS_MESSAGES.invited,
        inactive: ACCESS_MESSAGES.inactive,
        error: ACCESS_MESSAGES.sessionError,
      } as const
      setAccessError(messages[status])
      setLoading(false)
      return
    }
    if (status === 'ready') setLoading(false)
  }, [status, router, pathname, session.role])

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

  if (accessError) {
    return <div className="min-h-screen flex items-center justify-center p-4"><div className="card max-w-sm p-6 text-center"><p className="text-sm text-danger" role="alert">{accessError}</p><div className="mt-4 flex flex-col gap-2"><button onClick={() => void session.refresh()} className="btn-primary">Reintentar</button><button onClick={() => void handleLogout()} className="text-sm underline underline-offset-2">Cerrar sesión</button></div></div></div>
  }

  // El menú es el de fábrica hasta que alguien lo cambie en Configuración →
  // Paneles: ahí se oculta lo que no se usa, se reordena, y se decide qué ve
  // un supervisor.
  const role = 'role' in session && typeof session.role === 'string' ? session.role : ROLES.ADMIN
  const navItems = applyPanelPreferences(NAV_ITEMS, config.adminPanels, role)
    .map((item) => (item.id === 'chat' ? { ...item, badge: unreadChats } : item))

  // Sin ReservationsProvider aquí: escuchaba `reservations` en cada panel de
  // admin y sólo lo usa el historial anterior, que ahora lo monta al abrirse.
  return (
    <AdminShell navItems={navItems} onLogout={handleLogout} version={version}>
      <GeofenceAlertsBanner />
      {children}
    </AdminShell>
  )
}
