'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, authPersistenceReady, db } from '@/firebase/config'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { Events } from '@/lib/analytics'
import { classifyGoogleError, classifyLoginError, clearSessionCookie, setSessionCookie } from '@/lib/auth'
import { evaluateWalkerProfileAccess, googleAuthProvider, isGoogleAuthConfigured } from '@/lib/googleAuth'
import { evaluateTeamAccess, refreshTokenAndGetRole, resolveDestination, type TeamAccessDenial } from '@/lib/roles'

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

export default function TeamLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accessDenial, setAccessDenial] = useState<TeamAccessDenial | null>(null)

  const finishTeamLogin = async (user: User) => {
    const resolution = await refreshTokenAndGetRole({
      getIdToken: (forceRefresh) => user.getIdToken(forceRefresh),
      getIdTokenResult: () => user.getIdTokenResult(),
    })
    const access = evaluateTeamAccess(resolution)
    if (!access.allowed) {
      setAccessDenial(access.reason)
      setError(access.message)
      return
    }

    if (access.role === 'walker') {
      const profileSnap = await getDoc(doc(db, 'walkerProfiles', user.uid))
      const profileAccess = evaluateWalkerProfileAccess(profileSnap.exists() ? profileSnap.data() : null)
      if (!profileAccess.allowed) {
        setError(profileAccess.message)
        return
      }
    }

    setSessionCookie()
    router.replace(resolveDestination(access.role, searchParams.get('redirect')))
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return
    setError('')
    setAccessDenial(null)
    setLoading(true)
    try {
      await authPersistenceReady
      const credential = await signInWithEmailAndPassword(auth, email, password)
      Events.loginMethod('email')
      await finishTeamLogin(credential.user)
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
      if (code === 'auth/invalid-credential') {
        setError('Error de autenticación: credenciales inválidas. Por favor verifica tu correo y contraseña.')
      } else if (code === 'auth/user-not-found') {
        setError('Correo no registrado. Por favor verifica tu correo.')
      } else if (code === 'auth/wrong-password') {
        setError('Contraseña incorrecta. Por favor intenta de nuevo.')
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos de inicio de sesión. Espera un momento e inténtalo de nuevo.')
      } else if (code === 'auth/network-request-failed') {
        setError('Error de conexión. Verifica tu red e inténtalo de nuevo.')
      } else {
        setError(classifyLoginError(e))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setAccessDenial(null)
    if (!isGoogleAuthConfigured()) {
      setError('El acceso con Google no está configurado. Usa correo y contraseña.')
      return
    }
    setLoading(true)
    try {
      await authPersistenceReady
      const credential = await signInWithPopup(auth, googleAuthProvider)
      Events.loginMethod('google')
      await finishTeamLogin(credential.user)
    } catch (cause: unknown) {
      setError(classifyGoogleError(cause))
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    clearSessionCookie()
    await signOut(auth)
    setAccessDenial(null)
    setError('')
    setPassword('')
  }

  return (
    <div className="space-y-3">
      {isGoogleAuthConfigured() ? (
        <button
          type="button"
          onClick={() => void handleGoogleLogin()}
          disabled={loading}
          className="btn btn-secondary w-full"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <GoogleMark />}
          Continuar con Google
        </button>
      ) : (
        <p className="rounded-xl p-3 text-xs text-center" role="status" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          El acceso con Google no está configurado. Usa correo y contraseña.
        </p>
      )}

      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>o con correo</span>
        <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      <div>
        <label htmlFor="team-login-email" className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
          Correo del equipo
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            id="team-login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="equipo@petap.com"
            autoComplete="email"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/30"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="team-login-password" className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            id="team-login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/30"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {error && <p className="text-red-700 text-xs" role="alert">{error}</p>}

      {accessDenial && (
        <div className="rounded-xl p-3 text-xs space-y-2" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
          {accessDenial === 'customer-account' && (
            <Link href="/login" className="font-semibold text-brand-700 underline underline-offset-2">
              Ir al acceso de Familia PET
            </Link>
          )}
          <button type="button" onClick={() => void handleLogout()} className="block font-semibold text-red-700 underline underline-offset-2">
            Cerrar esta sesión
          </button>
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading || !email.trim() || !password.trim()}
        className="btn btn-primary w-full"
      >
        {loading ? <Loader2 className="animate-spin" size={14} /> : null}
        Entrar al equipo
      </button>
    </div>
  )
}
