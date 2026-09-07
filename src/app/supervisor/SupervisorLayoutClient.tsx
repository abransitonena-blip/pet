'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { accessPathWithRedirect, clearSessionCookie } from '@/lib/auth'
import { useSessionRole } from '@/lib/useSessionRole'
import { ACCESS_MESSAGES, ROLES, ROLE_HOME } from '@/lib/roles'
import AppShell from '@/components/layout/AppShell'
import { LayoutDashboard, AlertTriangle, ShieldAlert } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'operacion', label: 'Operación', icon: LayoutDashboard, color: '#7c3aed', href: '/supervisor' },
  { id: 'incidencias', label: 'Incidencias', icon: AlertTriangle, color: '#b91c1c', href: '/supervisor/incidencias' },
]

export default function SupervisorLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('Supervisor')
  const [accessError, setAccessError] = useState('')

  const session = useSessionRole([ROLES.SUPERVISOR])
  const { status, uid } = session

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
    if (status === 'ready') {
      setName(auth.currentUser?.displayName || 'Supervisor')
      setLoading(false)
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
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white mx-auto mb-3">
            <ShieldAlert size={20} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando supervisión...</p>
        </div>
      </div>
    )
  }

  if (accessError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="rounded-2xl p-8 text-center max-w-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No pudimos abrir supervisión</h2>
          <p className="text-sm mb-6" role="alert" style={{ color: 'var(--text-muted)' }}>{accessError}</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => void session.refresh()} className="btn-primary">Reintentar</button>
            <button onClick={() => void handleLogout()} className="text-sm underline underline-offset-2">Cerrar sesión</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AppShell navItems={NAV_ITEMS} userName={name} userRole="supervisor" onLogout={handleLogout} logoHref="/supervisor">
      {children}
    </AppShell>
  )
}
