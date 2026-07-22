'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  GoogleAuthProvider, signInWithPopup, signOut, type User,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { FaTimes, FaSpinner, FaUser, FaEnvelope, FaLock, FaDog, FaPhone, FaGoogle } from 'react-icons/fa'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (uid: string) => void
  needsPhoneUser?: User | null
}

export default function ClientAuth({ isOpen, onClose, onSuccess, needsPhoneUser }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [needsPhone, setNeedsPhone] = useState(false)
  const [googleUser, setGoogleUser] = useState<User | null>(null)

  useEffect(() => {
    if (needsPhoneUser) {
      setGoogleUser(needsPhoneUser)
      setName(needsPhoneUser.displayName || '')
      setNeedsPhone(true)
    }
  }, [needsPhoneUser])

  const reset = () => {
    setEmail(''); setPassword(''); setName(''); setPhone('')
    setError(''); setGoogleUser(null); setNeedsPhone(false)
  }

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      // localStorage.setItem('pq_google_pending', '1')
      await signInWithPopup(auth, provider)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'intenta de nuevo'
      setError('Error: ' + msg)
      setGoogleLoading(false)
    }
  }

  const finishGoogleSignup = async () => {
    if (!googleUser || !phone.trim() || phone.trim().length < 10) {
      setError('Teléfono inválido (mín 10 dígitos)')
      return
    }
    setLoading(true)
    try {
      await setDoc(doc(db, 'clients', googleUser.uid), {
        name: googleUser.displayName || '',
        email: googleUser.email || '',
        phone: phone.trim(),
        createdAt: new Date().toISOString(),
      })
      onSuccess(googleUser.uid)
      onClose()
    } catch { setError('Error al guardar tus datos') }
    setLoading(false)
  }

  const handleLogin = async () => {
    setError(''); setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const snap = await getDoc(doc(db, 'clients', cred.user.uid))
      if (!snap.exists()) {
        await signOut(auth)
        setError('Esta cuenta no es de cliente')
        setLoading(false); return
      }
      onSuccess(cred.user.uid); onClose()
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential')
        setError('Correo o contraseña incorrectos')
      else if (code === 'auth/invalid-email') setError('Correo inválido')
      else setError('Error al iniciar sesión')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setError('')
    if (!name.trim()) { setError('Ingresa tu nombre'); return }
    if (!phone.trim() || phone.trim().length < 10) { setError('Teléfono inválido'); return }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: name })
      await setDoc(doc(db, 'clients', cred.user.uid), {
        name: name.trim(), email: email.trim(), phone: phone.trim(),
        createdAt: new Date().toISOString(),
      })
      onSuccess(cred.user.uid); onClose()
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
      if (code === 'auth/email-already-in-use') setError('Correo ya registrado')
      else if (code === 'auth/weak-password') setError('Mínimo 6 caracteres')
      else if (code === 'auth/invalid-email') setError('Correo inválido')
      else setError('Error al registrarse')
    }
    setLoading(false)
  }

  const toggleMode = () => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="rounded-2xl p-6 sm:p-8 w-full max-w-sm mx-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <FaDog className="text-primary" size={18} />
                <span className="text-sm font-bold gradient-text">
                  {needsPhone ? 'Completa tu registro' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                </span>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--glass-bg)' }}>
                <FaTimes size={12} />
              </button>
            </div>

            {needsPhone && googleUser ? (
              <div className="space-y-3">
                <p className="text-xs text-white/40">Solo falta tu WhatsApp para completar el registro con Google</p>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>WhatsApp</label>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3">
                    <FaPhone className="text-white/20" size={12} />
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-transparent py-2.5 text-white text-sm focus:outline-none placeholder:text-white/20"
                      placeholder="5523053772" />
                  </div>
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button onClick={finishGoogleSignup} disabled={loading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-amber-600 text-white hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {loading && <FaSpinner className="animate-spin" size={14} />}
                  Guardar y entrar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={handleGoogle} disabled={googleLoading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                >
                  {googleLoading ? <FaSpinner className="animate-spin" size={14} /> : <FaGoogle size={14} />}
                  Continuar con Google
                </button>

                <div className="flex items-center gap-3 py-1">
                  <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>o con correo</span>
                  <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                </div>

                {mode === 'register' && (
                  <>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nombre</label>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3">
                        <FaUser className="text-white/20" size={12} />
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                          className="w-full bg-transparent py-2.5 text-white text-sm focus:outline-none placeholder:text-white/20"
                          placeholder="Tu nombre" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>WhatsApp</label>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3">
                        <FaPhone className="text-white/20" size={12} />
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                          className="w-full bg-transparent py-2.5 text-white text-sm focus:outline-none placeholder:text-white/20"
                          placeholder="5523053772" />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Correo</label>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3">
                    <FaEnvelope className="text-white/20" size={12} />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent py-2.5 text-white text-sm focus:outline-none placeholder:text-white/20"
                      placeholder="correo@ejemplo.com" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Contraseña</label>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3">
                    <FaLock className="text-white/20" size={12} />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent py-2.5 text-white text-sm focus:outline-none placeholder:text-white/20"
                      placeholder="••••••••" />
                  </div>
                </div>

                {error && <p className="text-red-400 text-xs">{error}</p>}

                <button onClick={mode === 'login' ? handleLogin : handleRegister}
                  disabled={loading || !email.trim() || !password.trim()}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-amber-600 text-white hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {loading && <FaSpinner className="animate-spin" size={14} />}
                  {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                </button>

                <div className="text-center pt-2">
                  <button onClick={toggleMode} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
