'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { FaDog, FaGoogle, FaEnvelope, FaLock, FaSpinner, FaUser } from 'react-icons/fa'
import { brand } from '@/lib/brand'

type Mode = 'select' | 'familia' | 'equipo'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('select')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const snap = await getDoc(doc(db, 'clients', result.user.uid))
      if (snap.exists()) {
        router.push('/mi-cuenta')
      } else {
        setError('Esta cuenta no tiene un perfil de familia registrado')
      }
    } catch {
      setError('Error al iniciar sesión con Google')
    }
    setLoading(false)
  }

  const handleEmailLogin = async (role: 'client' | 'admin') => {
    setLoading(true)
    setError('')
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      if (role === 'admin') {
        const userSnap = await getDoc(doc(db, 'users', cred.user.uid))
        const isAdmin = userSnap.exists() && userSnap.data()?.role === 'admin'
        if (!isAdmin) {
          setError('Acceso no autorizado')
          await auth.signOut()
          return
        }
        router.push('/admin')
      } else {
        const snap = await getDoc(doc(db, 'clients', cred.user.uid))
        if (snap.exists()) {
          router.push('/mi-cuenta')
        } else {
          setError('Esta cuenta no es de familia')
          await auth.signOut()
        }
      }
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos')
      } else if (code === 'auth/invalid-email') {
        setError('Correo inválido')
      } else {
        setError('Error al iniciar sesión')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-2xl mx-auto mb-4 shadow-glow">
            <FaDog />
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {mode === 'select' && 'Bienvenido a ' + brand.name}
            {mode === 'familia' && 'Familia PET'}
            {mode === 'equipo' && 'Acceso Equipo'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {mode === 'select' && 'Elige cómo quieres acceder'}
            {mode === 'familia' && 'Accede para ver tus reservas, fotos y más'}
            {mode === 'equipo' && 'Panel de administración'}
          </p>
        </div>

        {mode === 'select' && (
          <div className="space-y-3">
            {/* Familia PET */}
            <button
              onClick={() => setMode('familia')}
              className="w-full rounded-2xl p-5 text-left transition-all duration-200 hover:border-brand-500/30 group"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-success-500/10 flex items-center justify-center text-success-400 shrink-0">
                  <FaUser size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Familias PET
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Reserva paseos, revisa fotos del recorrido, gestiona tus perros y historial.
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 text-2xs font-medium text-brand-400">
                    <span>Continuar con Google</span>
                    <span>·</span>
                    <span>o correo</span>
                  </div>
                </div>
              </div>
            </button>

            {/* Equipo PET — discreet link */}
            <button
              onClick={() => setMode('equipo')}
              className="w-full text-center py-3 text-xs font-medium transition-colors hover:text-white/60"
              style={{ color: 'var(--text-muted)' }}
            >
              Acceso equipo →
            </button>
          </div>
        )}

        {mode === 'familia' && (
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                {loading ? <FaSpinner className="animate-spin" size={14} /> : <FaGoogle size={14} />}
                Continuar con Google
              </button>

              <div className="flex items-center gap-3 py-1">
                <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>o con correo</span>
                <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>

              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Correo</label>
                <div className="relative">
                  <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {error && <p className="text-danger-400 text-xs">{error}</p>}

              <button
                onClick={() => handleEmailLogin('client')}
                disabled={loading || !email.trim() || !password.trim()}
                className="btn-primary w-full"
              >
                {loading ? <FaSpinner className="animate-spin" size={14} /> : null}
                Entrar
              </button>
            </div>

            <div className="mt-4 pt-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setMode('select'); setError(''); setEmail(''); setPassword('') }} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ← Volver
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
                  <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@petap.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin('admin')}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {error && <p className="text-danger-400 text-xs">{error}</p>}

              <button
                onClick={() => handleEmailLogin('admin')}
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-500 to-accent-600 text-white hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? <FaSpinner className="animate-spin" size={14} /> : null}
                Acceder al panel
              </button>
            </div>

            <div className="mt-4 pt-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setMode('select'); setError(''); setEmail(''); setPassword('') }} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ← Volver
              </button>
            </div>
          </div>
        )}

        {/* Back to home */}
        <div className="text-center mt-6">
          <a href="/" className="text-xs transition-colors hover:text-brand-400" style={{ color: 'var(--text-muted)' }}>
            ← Volver al sitio
          </a>
        </div>
      </motion.div>
    </div>
  )
}
