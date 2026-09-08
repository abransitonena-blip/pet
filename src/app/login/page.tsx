'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth'
import { auth, authPersistenceReady } from '@/firebase/config'
import { GOOGLE_CLIENT_ID, googleAuthProvider } from '@/lib/googleAuth'
import { Mail, Lock, Loader2, User, Phone } from 'lucide-react'
import { Events } from '@/lib/analytics'
import { ensureCanonicalCustomerProfile, updateCustomerProfile } from '@/lib/customerProfile'
import { Logo } from '@/components/ui/Logo'
import { refreshTokenAndGetRole, resolveDestination as resolveDestinationShared, type Role } from '@/lib/roles'
import {
  setSessionCookie,
  isWebView,
  classifyFamilyLoginError,
  classifyLoginError,
  familyLoginError,
  isFamilyLoginFlowError,
  RESET_LINK_SENT_MESSAGE,
} from '@/lib/auth'

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


function getSafeRedirect(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('redirect')
}

function resolveDestination(role: Role): string {
   return resolveDestinationShared(role, getSafeRedirect())
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
  const [familiaMode, setFamiliaMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [, setGisReady] = useState(false)
  const [gisError, setGisError] = useState(false)
  const [webView, setWebView] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const googleAttemptRef = useRef(false)
  const initializedRef = useRef(false)
  const gisScriptRef = useRef<HTMLScriptElement | null>(null)
  const [authState, setAuthState] = useState<{
    stage: string;
    error: string | null;
    code: string | null;
    provider: string | null;
    browser: string | null;
    correlationId: string;
    timestamp: string;
  }>({
    stage: 'idle',
    error: null,
    code: null,
    provider: null,
    browser: null,
    correlationId: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
  })

  const updateAuthState = (stage: string, error?: string | null, code?: string | null, provider?: string | null, browser?: string | null) => {
    setAuthState({
      stage,
      error: error ?? null,
      code: code ?? null,
      provider: provider ?? null,
      browser: browser ?? null,
      correlationId: authState.correlationId,
      timestamp: new Date().toISOString(),
    });
  };

  useEffect(() => {
    setWebView(isWebView())
  }, [])

  const finalizeGoogle = useCallback(async (user: { uid: string; displayName: string | null; email: string | null }) => {
    const currentUser = auth.currentUser
    if (!currentUser || currentUser.uid !== user.uid) {
      throw familyLoginError('auth', { code: 'auth/session-unavailable' })
    }
    let role: Role
    try {
      ;({ role } = await refreshTokenAndGetRole({
        getIdToken: (forceRefresh) => currentUser.getIdToken(forceRefresh),
        getIdTokenResult: () => currentUser.getIdTokenResult(),
      }))
    } catch (cause) {
      throw familyLoginError('claims', cause)
    }

    updateAuthState('role_resolved')
    if (role === 'customer') {
      updateAuthState('profile_loading')
      try {
        const profileResult = await ensureCanonicalCustomerProfile(user)
        updateAuthState(profileResult === 'created' ? 'profile_created' : 'profile_existing')
      } catch (cause) {
        throw familyLoginError('profile', cause)
      }
    }
    setSessionCookie()
    router.replace(resolveDestination(role))
  }, [router])

  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    if (!response.credential) {
      updateAuthState('google_credential_received', 'Google no devolvió un token de identificación.', 'missing-credential', 'GoogleIdentityServices')
      setLoading(false)
      return
    }
    if (googleAttemptRef.current) return
    googleAttemptRef.current = true
    setLoading(true)
    updateAuthState('google_credential_received', null, null, 'GoogleIdentityServices')
    try {
      await authPersistenceReady
      const credential = GoogleAuthProvider.credential(response.credential)
      const result = await signInWithCredential(auth, credential)
      Events.loginMethod('google')
      updateAuthState('firebase_credential_created')
      await finalizeGoogle(result.user)
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
      const friendlyError = classifyFamilyLoginError(e)
      const stage = isFamilyLoginFlowError(e) ? e.stage : 'auth'
      updateAuthState(`${stage}_failed`, friendlyError, code, 'GoogleIdentityServices')
      setError(friendlyError)
    } finally {
      googleAttemptRef.current = false
      setLoading(false)
    }
  }, [finalizeGoogle])

  const handleGooglePopup = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('El acceso con Google no está configurado. Usa correo y contraseña.')
      return
    }
    if (googleAttemptRef.current) return
    googleAttemptRef.current = true
    setLoading(true)
    updateAuthState('google_ui_loaded', null, null, 'GoogleIdentityServices')
    try {
      await authPersistenceReady
      const result = await signInWithPopup(auth, googleAuthProvider)
      Events.loginMethod('google')
      updateAuthState('firebase_credential_created')
      await finalizeGoogle(result.user)
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
      const friendlyError = classifyFamilyLoginError(e)
      const stage = isFamilyLoginFlowError(e) ? e.stage : 'oauth'
      updateAuthState(`${stage}_failed`, friendlyError, code, 'GoogleIdentityServices')
      setError(friendlyError)
    } finally {
      googleAttemptRef.current = false
      setLoading(false)
    }
  }, [finalizeGoogle])

  const loadGisScript = useCallback((onDone: () => void) => {
    if (typeof document === 'undefined') return
    if (gisScriptRef.current) {
      gisScriptRef.current.onload = null
      gisScriptRef.current.onerror = null
      gisScriptRef.current.remove()
      gisScriptRef.current = null
    }
    updateAuthState('google_script_loading', null, null, 'GoogleIdentityServices')
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => {
      updateAuthState('google_script_loaded', null, null, 'GoogleIdentityServices')
      onDone()
    }
    s.onerror = () => {
      updateAuthState('google_script_error', 'No pudimos cargar Google en este momento.', 'script-load-failed', 'GoogleIdentityServices')
      setGisError(true)
    }
    gisScriptRef.current = s
    document.head.appendChild(s)
  }, [])

  const renderGoogleButton = useCallback(() => {
    const el = googleButtonRef.current
    if (!window.google?.accounts?.id || !el) return false

    if (!GOOGLE_CLIENT_ID) {
      setGisError(true)
      return true
    }

    if (!initializedRef.current) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      initializedRef.current = true
    }

    el.replaceChildren()

    const availableWidth = Math.floor(el.getBoundingClientRect().width)
    window.google.accounts.id.renderButton(el, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: Math.min(320, availableWidth > 0 ? availableWidth : 320),
    })

    setGisReady(true)
    return true
  }, [handleGoogleCredential])

  useEffect(() => {
    if (webView || !GOOGLE_CLIENT_ID) return
    loadGisScript(() => { renderGoogleButton() })
    return () => {
      if (gisScriptRef.current) {
        gisScriptRef.current.onload = null
        gisScriptRef.current.onerror = null
        gisScriptRef.current.remove()
        gisScriptRef.current = null
      }
    }
  }, [webView, loadGisScript, renderGoogleButton])

  useEffect(() => {
    if (webView || !GOOGLE_CLIENT_ID) return
    const t = setTimeout(() => {
      if (!window.google?.accounts?.id && !initializedRef.current) {
        setGisError(true)
      }
    }, 8000)
    return () => clearTimeout(t)
  }, [webView])

const handleEmailLogin = async () => {
      setLoading(true)
    setError('')
    try {
      await authPersistenceReady
      const cred = await signInWithEmailAndPassword(auth, email, password)
      Events.loginMethod('email')
      await finalizeGoogle(cred.user)
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
      if (isFamilyLoginFlowError(e)) {
        setError(classifyFamilyLoginError(e))
      } else if (code === 'auth/invalid-credential') {
        setError('Credenciales inválidas. Verifica tu correo y contraseña.')
      } else if (code === 'auth/user-not-found') {
        setError('Correo no registrado. Verifica tu correo o crea una cuenta.')
      } else if (code === 'auth/wrong-password') {
        setError('Contraseña incorrecta. Intenta de nuevo o restablece tu contraseña.')
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Espera un momento e inténtalo de nuevo.')
      } else if (code === 'auth/network-request-failed') {
        setError('Error de conexión. Verifica tu red e inténtalo de nuevo.')
      } else {
        setError(classifyLoginError(e))
      }
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
      await authPersistenceReady
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: name })
      try {
        await ensureCanonicalCustomerProfile({ uid: cred.user.uid, displayName: name.trim(), email: email.trim() })
        if (phone.trim()) await updateCustomerProfile(cred.user.uid, { phone: phone.trim() })
      } catch (cause) {
        throw familyLoginError('profile', cause)
      }
      await finalizeGoogle(cred.user)
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
      if (isFamilyLoginFlowError(e)) setError(classifyFamilyLoginError(e))
      else if (code === 'auth/email-already-in-use') setError('Correo ya registrado')
      else if (code === 'auth/weak-password') setError('Mínimo 6 caracteres')
      else if (code === 'auth/invalid-email') setError('Correo inválido')
      else setError('Error al registrarse')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen overflow-x-hidden flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="w-full min-w-0 max-w-md"
      >
        <div className="text-center mb-8">
          <div className="mx-auto block mb-4" aria-label="Logo PET Ap">
            <Logo size={56} rounded="rounded-2xl" className="shadow-glow" />
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Familia PET
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Accede para ver tus reservas, fotos y más
          </p>
        </div>

                  <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="space-y-3">
              {!GOOGLE_CLIENT_ID ? (
                <p className="rounded-xl p-3 text-xs text-center text-muted" role="status" style={{ border: '1px solid var(--border)' }}>
                  El acceso con Google no está configurado. Usa correo y contraseña.
                </p>
              ) : webView ? (
                <div className="rounded-xl p-4 text-center space-y-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Para ingresar con Google, abre PET Ap en Safari o Chrome.
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>También puedes continuar abajo con correo y contraseña.</p>
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
                <div ref={googleButtonRef} className="min-h-[40px] min-w-0 max-w-full overflow-hidden flex justify-center" />
              )}

              <div className="flex items-center gap-3 py-1">
                <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>o con correo</span>
                <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>

              {familiaMode === 'register' && (
                <>
                  <div>
                    <label htmlFor="login-name" className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Nombre</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                      <input
                        id="login-name"
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
                    <label htmlFor="login-phone" className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>WhatsApp (opcional)</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                      <input
                        id="login-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="55 3823 1235"
                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="login-email" className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Correo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    id="login-email"
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
                <label htmlFor="login-password" className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    id="login-password"
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
                onClick={familiaMode === 'login' ? () => handleEmailLogin() : handleRegister}
                disabled={loading || !email.trim() || !password.trim()}
                className="btn btn-primary w-full"
              >
                {loading ? <Loader2 className="animate-spin" size={14} /> : null}
                {familiaMode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>

              {familiaMode === 'login' && (
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="flex min-h-11 w-full items-center justify-center text-center text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>

            <div className="mt-4 pt-4 text-center space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { setFamiliaMode(familiaMode === 'login' ? 'register' : 'login'); setError('') }}
                className="flex min-h-11 w-full items-center justify-center text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                {familiaMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>
          </div>

        <div className="text-center mt-6">
          <a href="/" className="inline-flex min-h-11 items-center px-3 text-xs transition-colors hover:text-brand-600" style={{ color: 'var(--text-muted)' }}>
            ← Volver al sitio
          </a>
        </div>
      </motion.div>
    </div>
  )
}
