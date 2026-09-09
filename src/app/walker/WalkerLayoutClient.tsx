'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { AlertTriangle, Dog, History, Home, MessagesSquare, UserRound } from 'lucide-react'
import { auth, db } from '@/firebase/config'
import { accessPathWithRedirect, clearSessionCookie } from '@/lib/auth'
import { useSessionRole } from '@/lib/useSessionRole'
import { ACCESS_MESSAGES, ROLES, ROLE_HOME } from '@/lib/roles'
import AppShell from '@/components/layout/AppShell'
import WalkerHeartbeat from '@/components/WalkerHeartbeat'
import { Button, Card, LoadingState } from '@/components/ui'
import {
  WalkerPanelProvider,
  type WalkerPanelProfile,
} from '@/app/walker/WalkerPanelContext'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Mis paseos', icon: Home, href: '/walker' },
  { id: 'historial', label: 'Historial', icon: History, href: '/walker/historial' },
  { id: 'chat', label: 'Mensajes', icon: MessagesSquare, href: '/walker/chat' },
  { id: 'perfil', label: 'Mi perfil', icon: UserRound, href: '/walker/perfil' },
]

function profileFromData(data: Record<string, unknown>, fallbackName: string, fallbackEmail: string): WalkerPanelProfile {
  return {
    name: typeof data.name === 'string' && data.name.trim() ? data.name : fallbackName,
    email: typeof data.email === 'string' && data.email.trim() ? data.email : fallbackEmail,
    phone: typeof data.phone === 'string' ? data.phone : '',
    status: typeof data.status === 'string' ? data.status : 'inactive',
    zones: Array.isArray(data.zones) ? data.zones.filter((zone): zone is string => typeof zone === 'string') : [],
    schedule: data.schedule && typeof data.schedule === 'object'
      ? data.schedule as Record<string, { start: string; end: string }[]>
      : {},
    maxDaily: typeof data.maxDaily === 'number' ? data.maxDaily : null,
    maxWeekly: typeof data.maxWeekly === 'number' ? data.maxWeekly : null,
    forcePasswordChange: data.forcePasswordChange === true,
  }
}

export default function WalkerLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<WalkerPanelProfile | null>(null)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const session = useSessionRole([ROLES.WALKER])
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
      setError(messages[status])
      return
    }
    if (status !== 'ready' || !uid) return

    let cancelled = false
    ;(async () => {
      try {
        const [userSnap, profileSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          getDoc(doc(db, 'walkerProfiles', uid)),
        ])
        if (cancelled) return
        if (!profileSnap.exists()) {
          setError(ACCESS_MESSAGES.walkerProfileMissing)
          return
        }
        const userData = userSnap.exists() ? userSnap.data() : {}
        const fallbackName = typeof userData.name === 'string' && userData.name.trim()
          ? userData.name
          : auth.currentUser?.displayName || 'Paseador'
        setProfile(profileFromData(profileSnap.data(), fallbackName, auth.currentUser?.email || ''))
        setError('')
      } catch (cause) {
        if (cancelled) return
        const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
        setError(code.includes('permission-denied')
          ? 'Tu sesión no tiene permiso para cargar el perfil operativo.'
          : 'No pudimos cargar tu panel. Revisa tu conexión e inténtalo nuevamente.')
      }
    })()

    return () => { cancelled = true }
  }, [status, uid, router, pathname, session.role])

  const contextValue = useMemo(() => profile && uid ? {
    uid,
    profile,
    updateLocalProfile: (changes: Partial<WalkerPanelProfile>) => {
      setProfile((current) => current ? { ...current, ...changes } : current)
    },
  } : null, [profile, uid])

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    clearSessionCookie()
    try {
      await signOut(auth)
    } finally {
      router.replace('/equipo')
      setLoggingOut(false)
    }
  }

  if (status === 'loading' || (status === 'ready' && !contextValue && !error)) {
    return (
      <main id="main-content" className="min-h-screen grid place-items-center bg-canvas p-6">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex items-center justify-center gap-2 text-sm font-semibold text-ink">
            <Dog size={20} className="text-primary" /> Panel del paseador
          </div>
          <LoadingState message="Verificando tu sesión y perfil…" rows={2} height="h-12" />
        </div>
      </main>
    )
  }

  if (error || !contextValue) {
    return (
      <main id="main-content" className="min-h-screen grid place-items-center bg-canvas p-4">
        <Card className="w-full max-w-sm p-6 text-center shadow-none" role="alert">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-danger-500/10 text-red-700">
            <AlertTriangle size={20} />
          </div>
          <h1 className="text-lg font-bold text-ink">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted">{error || ACCESS_MESSAGES.sessionError}</p>
          <Button variant="danger" className="mt-6 w-full" onClick={() => void handleLogout()} isLoading={loggingOut}>
            Cerrar sesión
          </Button>
        </Card>
      </main>
    )
  }

  return (
    <WalkerPanelProvider value={contextValue}>
      <AppShell
        navItems={NAV_ITEMS}
        userName={contextValue.profile.name}
        userRole="Paseador"
        onLogout={() => void handleLogout()}
        logoHref="/"
        mustChangePassword={contextValue.profile.forcePasswordChange}
        headerExtra={<WalkerHeartbeat walkerId={contextValue.uid} walkerName={contextValue.profile.name} />}
        mobileNavigation
        showLogoutLabel
      >
        {children}
      </AppShell>
    </WalkerPanelProvider>
  )
}
