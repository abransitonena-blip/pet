'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { FaDog, FaSpinner } from 'react-icons/fa'

type Role = 'admin' | 'walker' | 'client' | 'supervisor' | null

interface AuthContextValue {
  uid: string
  role: Role
  loading: boolean
  isAdmin: boolean
  isWalker: boolean
  isClient: boolean
  isSupervisor: boolean
}

const AuthContext = createContext<AuthContextValue>({
  uid: '',
  role: null,
  loading: true,
  isAdmin: false,
  isWalker: false,
  isClient: false,
  isSupervisor: false,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState('')
  const [role, setRole] = useState<Role>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid('')
        setRole(null)
        setLoading(false)
        return
      }

      setUid(user.uid)

      // Read role from Firestore
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        setRole(snap.exists() ? snap.data()?.role || 'client' : 'client')
      } catch {
        setRole('client')
      }

      setLoading(false)
    })

    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{
      uid,
      role,
      loading,
      isAdmin: role === 'admin',
      isWalker: role === 'walker',
      isClient: role === 'client',
      isSupervisor: role === 'supervisor',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function RoleGuard({
  children,
  allowedRoles,
  fallback,
}: {
  children: ReactNode
  allowedRoles: Role[]
  fallback?: ReactNode
}) {
  const router = useRouter()
  const { role, loading } = useAuth()

  useEffect(() => {
    if (!loading && role && !allowedRoles.includes(role)) {
      // Redirect to appropriate dashboard based on role
      if (role === 'admin') router.push('/admin')
      else if (role === 'walker') router.push('/paseador')
      else router.push('/mi-cuenta')
    }
  }, [loading, role, allowedRoles, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <FaDog className="text-brand-500 text-3xl mx-auto mb-3 animate-pulse" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Verificando acceso...</p>
        </div>
      </div>
    )
  }

  if (!role || !allowedRoles.includes(role)) {
    return fallback ? <>{fallback}</> : null
  }

  return <>{children}</>
}
