'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { motion } from 'framer-motion'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { Mail, Lock, Loader2, User, Phone, PersonStanding, ExternalLink, Shield } from 'lucide-react'
import { brand } from '@/lib/brand'
import { Events } from '@/lib/analytics'
import { Logo } from '@/components/ui/Logo'
import {
  setSessionCookie,
  isWebView,
  classifyGoogleError,
  classifyLoginError,
  RESET_LINK_SENT_MESSAGE,
} from '@/lib/auth'

type Mode = 'select' | 'familia' | 'equipo' | 'paseador' | 'supervisor'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (element: HTMLElement, options: {
            type?: string
            theme?: string
            size?: string
            text?: string
            shape?: string
            logo_alignment?: string
            width?: number
          }) => void
          prompt: () => void
        }
      }
    }
  }
}

async function ensureCustomerProfile(user: { uid: string; displayName: string | null; email: string | null }) {
  const snap = await getDoc(doc(db, 'clients', user.uid))
  if (!snap.exists()) {
    await setDoc(doc(db, 'clients', user.uid), {
      name: user.displayName || '',
      email: user.email || '',
      phone: '',
      createdAt: serverTimestamp(),
    })
  }
}

const ROLE_HOME: Record<string, string> = {
   admin: '/admin',
   walker: '/walker',
   client: '/familia',
   supervisor: '/admin',
 }

function getSafeRedirect(): string | null {
  if (typeof window === 'undefined') return null
  const r = new URLSearchParams(window.location.search).get('redirect')
  if (!r || !r.startsWith('/') || r.startsWith('//')) return null
  return r
}

function resolveDestination(role: 'client' | 'admin' | 'walker' | 'supervisor'): string {
   const redirect = getSafeRedirect()
   if (!redirect) return ROLE_HOME[role]
   const prefix = redirect.split('/')[1] ?? ''
   const allowed: Record<string, string[]> = {
     admin: ['admin', 'familia', 'walker', 'mi-cuenta', 'paseador'],
     walker: ['walker', 'paseador'],
     client: ['familia', 'mi-cuenta'],
     supervisor: ['admin'],
   }
   if (allowed[role].includes(prefix)) return redirect
   return ROLE_HOME[role]
 }

function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('familia')
  const [familiaMode, setFamiliaMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showInternal, setShowInternal] = useState(false)
  const [gisReady, setGisReady] = useState(false)
  const [gisError, setGisError] = useState(false)
  const [webView, setWebView] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const initializedRef = useRef(false)
  const clickCount = useRef(0)
  const clickTimer = useRef<NodeJS.Timeout | null>(null)

  const handleLogoClick = useCallback(() => {
    clickCount.current += 1
    if (clickTimer.current) clearTimeout(clickTimer.current)
    if (clickCount.current >= 6) {
      clickCount.current = 0
      setShowInternal(true)
    }
    clickTimer.current = setTimeout(() => { clickCount.current = 0 }, 2000)
  }, [])

  useEffect(() => {
    setWebView(isWebView())
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlMode = params.get('mode') as Mode | null
    if (urlMode && ['familia', 'equipo', 'paseador', 'supervisor'].includes(urlMode)) {
      setMode(urlMode)
      setShowInternal(true)
    }
  }, [])

const finalizeGoogle = useCallback(async (user: { uid: string; displayName: string | null; email: string | null }) => {
     await ensureCustomerProfile(user)
     const userSnap = await getDoc(doc(db, 'users', user.uid))
     const role = userSnap.exists() ? userSnap.data()?.role : null
     if (role === 'admin' || role === 'walker' || role === 'supervisor') {
       setSessionCookie(role)
       router.replace(resolveDestination(role))
     } else {
       setSessionCookie('client')
       router.replace(resolveDestination('client'))
     }
   }, [router])

  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    if (!response.credential) {
      setError('Google no devolvió un token de identificación.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const credential = GoogleAuthProvider.credential(response.credential)
      const result = await signInWithCredential(auth, credential)
      Events.loginMethod('google')
      await finalizeGoogle(result.user)
    } catch (e) {
      setError(classifyGoogleError(e))
    } finally {
      setLoading(false)
    }
  }, [finalizeGoogle])

  const handleGooglePopup = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      Events.loginMethod('google')
      await finalizeGoogle(result.user)
    } catch (e) {
      setError(classifyGoogleError(e))
    } finally {
      setLoading(false)
    }
  }, [finalizeGoogle])

  const renderGoogleButton = useCallback(() => {
    const el = googleButtonRef.current
    if (!window.google?.accounts?.id || !el) return false

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
    if (!clientId) {
      setGisError(true)
      return true
    }

    if (!initializedRef.current) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      initializedRef.current = true
    }

    el.replaceChildren()

    window.google.accounts.id.renderButton(el, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 320,
    })

    setGisReady(true)
    return true
  }, [handleGoogleCredential])

  useEffect(() => {
    if (mode !== 'familia' || webView || gisError) return
    renderGoogleButton()
  }, [mode, webView, gisError, renderGoogleButton])

  useEffect(() => {
    if (mode !== 'familia' || webView) return
    const t = setTimeout(() => {
      if (!window.google?.accounts?.id && !initializedRef.current) {
        setGisError(true)
      }
    }, 8000)
    return () => clearTimeout(t)
  }, [mode, webView])

const handleEmailLogin = async (role: 'client' | 'admin' | 'walker' | 'supervisor') => {
     setLoading(true)
     setError('')
     try {
       const cred = await signInWithEmailAndPassword(auth, email, password)
       Events.loginMethod('email')
       if (role === 'admin' || role === 'walker' || role === 'supervisor') {
         const userSnap = await getDoc(doc(db, 'users', cred.user.uid))
         const userRole = userSnap.exists() ? userSnap.data()?.role : null
         if (role === 'admin' && userRole !== 'admin') {
           setError('Parece que no tienes acceso al panel de equipo')
           await auth.signOut()
           return
         }
         if (role === 'walker' && userRole !== 'walker') {
           setError('Parece que no tienes acceso de paseador')
           await auth.signOut()
           return
         }
         if (role === 'supervisor' && userRole !== 'supervisor') {
           setError('Parece que no tienes acceso de supervisor')
           await auth.signOut()
           return
         }
         setSessionCookie(role)
         router.push(resolveDestination(role))
       } else {
         await ensureCustomerProfile(cred.user)
         setSessionCookie('client')
         router.push(resolveDestination('client'))
       }
     } catch (e: unknown) {
       setError(classifyLoginError(e))
     }
     setLoading(false)
   }

  const handleForgotPassword = async () => {
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('Ingresa tu correo primero')
      return
    }
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setInfo(RESET_LINK_SENT_MESSAGE)
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
      if (code === 'auth/invalid-email') setError('Correo inválido')
      else if (code === 'auth/network-request-failed') setError('Error de red. Verifica tu conexión e intenta de nuevo.')
      else setInfo(RESET_LINK_SENT_MESSAGE)
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setError('')
    if (!name.trim()) { setError('Ingresa tu nombre'); return }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: name })
      await setDoc(doc(db, 'clients', cred.user.uid), {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        createdAt: serverTimestamp(),
      })
      setSessionCookie()
      router.push(resolveDestination('client'))
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
      if (code === 'auth/email-already-in-use') setError('Correo ya registrado')
      else if (code === 'auth/weak-password') setError('Mínimo 6 caracteres')
      else if (code === 'auth/invalid-email') setError('Correo inválido')
      else setError('Error al registrarse')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => { renderGoogleButton() }}
        onError={() => { setGisError(true) }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <button onClick={handleLogoClick} className="mx-auto block mb-4" aria-label="Logo PET Ap">
            <Logo size={56} rounded="rounded-2xl" className="shadow-glow" />
          </button>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {mode === 'select' && 'Bienvenido a ' + brand.name}
            {mode === 'familia' && 'Familia PET'}
            {mode === 'equipo' && 'Administración PET'}
            {mode === 'paseador' && 'Paseadores PET'}
            {mode === 'supervisor' && 'Supervisores PET'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {mode === 'select' && 'Elige cómo quieres acceder'}
            {mode === 'familia' && 'Accede para ver tus reservas, fotos y más'}
            {mode === 'equipo' && 'Panel de administración'}
            {mode === 'paseador' && 'Panel de paseos asignados'}
            {mode === 'supervisor' && 'Panel de supervisión'}
          </p>
        </div>

        {mode === 'select' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('familia')}
              className="w-full rounded-2xl p-5 text-left transition-all duration-200 hover:border-brand-500/30 group"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-success-500/10 flex items-center justify-center text-success-400 shrink-0">
                  <User size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Familias PET
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Reserva paseos, revisa fotos del recorrido, gestiona tus perros y historial.
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 text-2xs font-medium text-brand-600">
                    <span>Continuar con Google</span>
                    <span>·</span>
                    <span>o correo</span>
                  </div>
                </div>
              </div>
            </button>

            {showInternal && (
              <>
                <button
                  onClick={() => setMode('equipo')}
                  className="w-full text-center py-3 text-xs font-medium transition-colors hover:text-primary"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Acceso equipo →
                </button>
                <button
                  onClick={() => setMode('paseador')}
                  className="w-full text-center py-3 text-xs font-medium transition-colors hover:text-primary"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Acceso paseador →
                </button>
                <button
                  onClick={() => setMode('supervisor')}
                  className="w-full text-center py-3 text-xs font-medium transition-colors hover:text-primary"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Acceso supervisor →
                </button>
              </>
            )}
          </div>
        )}

        {mode === 'familia' && (
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="space-y-3">
              {webView ? (
                <div className="rounded-xl p-4 text-center space-y-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Para ingresar con Google, abre PET Ap en Safari o Chrome.
                  </p>
                  <button
                    onClick={() => window.location.href = 'googlechrome://' + window.location.host + window.location.pathname}
                    className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium transition-all"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  >
                    <ExternalLink size={10} /> Abrir en el navegador
                  </button>
                </div>
              ) : gisError ? (
                <div className="space-y-2">
                  <button
                    onClick={handleGooglePopup}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    <GoogleMark /> Continuar con Google
                  </button>
                  <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }} role="alert">
                    El botón estándar no cargó. Usa este acceso de respaldo.
                  </p>
                </div>
              ) : (
                <div ref={googleButtonRef} className="flex justify-center min-h-[40px]" />
              )}

              <div className="flex items-center gap-3 py-1">
                <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>o con correo</span>
                <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>

              {familiaMode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Nombre</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tu nombre"
                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>WhatsApp (opcional)</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="55 2305 3772"
                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Correo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {error && <p className="text-red-700 text-xs" role="alert">{error}</p>}
              {info && <p className="text-success-600 text-xs" role="status">{info}</p>}

              <button
                onClick={familiaMode === 'login' ? () => handleEmailLogin('client') : handleRegister}
                disabled={loading || !email.trim() || !password.trim()}
                className="btn-primary w-full"
              >
                {loading ? <Loader2 className="animate-spin" size={14} /> : null}
                {familiaMode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>

              {familiaMode === 'login' && (
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs block w-full text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>

            <div className="mt-4 pt-4 text-center space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { setFamiliaMode(familiaMode === 'login' ? 'register' : 'login'); setError('') }}
                className="text-xs block w-full"
                style={{ color: 'var(--text-muted)' }}
              >
                {familiaMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
              <button onClick={() => { setMode('select'); setFamiliaMode('login'); setError(''); setEmail(''); setPassword(''); setName(''); setPhone('') }} className="text-xs block w-full" style={{ color: 'var(--text-muted)' }}>
                ← Volver al sitio
              </button>
            </div>
          </div>
        )}

        {mode === 'equipo' && (
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Correo de administrador</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@petap.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin('admin')}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {error && <p className="text-red-700 text-xs" role="alert">{error}</p>}
              {info && <p className="text-success-600 text-xs" role="status">{info}</p>}

              <button
                onClick={() => handleEmailLogin('admin')}
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-500 to-accent-600 text-white hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={14} /> : null}
                Acceder al panel
              </button>

              <button
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-xs block w-full text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <div className="mt-4 pt-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setMode('select'); setError(''); setEmail(''); setPassword('') }} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ← Volver al sitio
              </button>
            </div>
          </div>
        )}

        {mode === 'paseador' && (
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Correo de paseador</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="paseador@petap.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-success-500/30"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin('walker')}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-success-500/30"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {error && <p className="text-red-700 text-xs" role="alert">{error}</p>}
              {info && <p className="text-success-600 text-xs" role="status">{info}</p>}

              <button
                onClick={() => handleEmailLogin('walker')}
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-success-500 to-success-600 text-white hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={14} /> : <PersonStanding size={14} />}
                Entrar como paseador
              </button>

              <button
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-xs block w-full text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <div className="mt-4 pt-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
<button onClick={() => { setMode('select'); setError(''); setEmail(''); setPassword('') }} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                 ← Volver al sitio
               </button>
             </div>
           </div>
         )}

         {mode === 'supervisor' && (
           <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
             <div className="space-y-3">
               <div>
                 <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Correo de supervisor</label>
                 <div className="relative">
                   <Mail className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                   <input
                     type="email"
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     placeholder="supervisor@petap.com"
                     autoComplete="email"
                     className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                     style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
                 <div className="relative">
                   <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                   <input
                     type="password"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin('supervisor')}
                     placeholder="••••••••"
                     autoComplete="current-password"
                     className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                     style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                   />
                 </div>
               </div>

               {error && <p className="text-red-700 text-xs" role="alert">{error}</p>}
               {info && <p className="text-success-600 text-xs" role="status">{info}</p>}

               <button
                 onClick={() => handleEmailLogin('supervisor')}
                 disabled={loading || !email.trim() || !password.trim()}
                 className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
               >
                 {loading ? <Loader2 className="animate-spin" size={14} /> : <Shield size={14} />}
                 Entrar como supervisor
               </button>

               <button
                 onClick={handleForgotPassword}
                 disabled={loading}
                 className="text-xs block w-full text-center"
                 style={{ color: 'var(--text-muted)' }}
               >
                 ¿Olvidaste tu contraseña?
               </button>
             </div>

             <div className="mt-4 pt-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
               <button onClick={() => { setMode('select'); setError(''); setEmail(''); setPassword('') }} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                 ← Volver al sitio
               </button>
             </div>
           </div>
         )}

         <div className="text-center mt-6">
          <a href="/" className="text-xs transition-colors hover:text-brand-600" style={{ color: 'var(--text-muted)' }}>
            ← Volver al sitio
          </a>
        </div>
      </motion.div>
    </div>
  )
}
