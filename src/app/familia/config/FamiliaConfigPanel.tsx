'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { getCustomerProfile, updateCustomerProfile } from '@/lib/customerProfile'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import { Settings, Check, LogOut, KeyRound, PawPrint, MapPin, Bell, ShieldCheck, MessagesSquare } from 'lucide-react'
import Link from 'next/link'
import { Button, Card, Input } from '@/components/ui'

/**
 * Cuenta y datos de contacto.
 *
 * This page held two fields and a save button, which left the person with no
 * way to see which email their account uses, reset their password, sign out,
 * or reach the rest of their account from one place. Everything added here is
 * an existing capability that simply had no entry point -- no new data is
 * collected, and passwords are never typed or shown: the reset goes out as a
 * Firebase email to the address on the account.
 */

const RESET_SENT = 'Te enviamos un enlace para cambiar tu contraseña al correo de tu cuenta.'

const SHORTCUTS = [
  { href: '/familia/perros', label: 'Mis perros', icon: PawPrint },
  { href: '/familia/direcciones', label: 'Mis direcciones', icon: MapPin },
  { href: '/familia/mensajes', label: 'Mensajes con PET Ap', icon: MessagesSquare },
  { href: '/familia/notificaciones', label: 'Notificaciones', icon: Bell },
  { href: '/familia/privacidad', label: 'Privacidad y ARCO', icon: ShieldCheck },
]

export default function ConfigPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [memberSince, setMemberSince] = useState('')
  const [counts, setCounts] = useState<{ dogs: number; addresses: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }
      setEmail(user.email || '')
      const profile = await getCustomerProfile(user.uid).catch(() => null)
      if (profile) {
        setName(profile.name || '')
        setPhone(profile.phone || '')
        const createdAt = (profile as { createdAt?: { seconds?: number } }).createdAt
        if (createdAt?.seconds) {
          setMemberSince(new Date(createdAt.seconds * 1000).toLocaleDateString('es-MX', {
            day: 'numeric', month: 'long', year: 'numeric',
          }))
        }
      }
      // Both counts come from the person's own documents, which the rules
      // already let them read; nothing here reaches another account's data.
      const [dogsSnap, addressesSnap] = await Promise.all([
        getDocs(query(collection(db, 'dogs'), where('ownerId', '==', user.uid), limit(50))).catch(() => null),
        getDocs(query(collection(db, 'addresses'), where('ownerId', '==', user.uid), limit(50))).catch(() => null),
      ])
      if (dogsSnap && addressesSnap) setCounts({ dogs: dogsSnap.size, addresses: addressesSnap.size })
      setLoading(false)
    })
    return unsub
  }, [router])

  const handleSave = async () => {
    const user = auth.currentUser
    if (!user) return
    setSaving(true)
    setSaveError('')
    try {
      await updateCustomerProfile(user.uid, { name, phone })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaveError('No pudimos guardar tus datos. Revisa tu conexión e inténtalo de nuevo.')
    }
    setSaving(false)
  }

  const handlePasswordReset = async () => {
    const address = auth.currentUser?.email
    if (!address) {
      setNotice('Tu cuenta entra con Google, así que la contraseña se administra desde tu cuenta de Google.')
      return
    }
    setResetting(true)
    setNotice('')
    try {
      await sendPasswordResetEmail(auth, address)
    } catch {
      // Firebase reports "user not found" the same way as success by design;
      // saying more here would leak which addresses exist.
    }
    setNotice(RESET_SENT)
    setResetting(false)
  }

  const handleSignOut = async () => {
    await signOut(auth).catch(() => {})
    router.push('/login')
  }

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <Settings className="text-3xl mx-auto mb-2 animate-pulse motion-reduce:animate-none" style={{ color: 'var(--text-muted)' }} />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* La pantalla no tenía título propio: sus tarjetas empezaban en h2 y
          quien navega con lector de pantalla no sabía dónde había aterrizado. */}
      <header>
        <h1 className="text-xl font-bold text-ink">Configuración</h1>
        <p className="mt-0.5 text-sm text-muted">Tus datos de contacto y el acceso a tu cuenta.</p>
      </header>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold text-ink">Datos de contacto</h2>
        <p className="mb-4 text-xs text-muted">
          Se usan para tu cuenta y para el contacto operativo de los paseos. No implican marketing ni publicación de fotografías.
        </p>
        <div className="max-w-sm space-y-4">
          <div>
            <label htmlFor="config-name" className="mb-1.5 block text-xs font-medium text-muted">Nombre <span aria-hidden="true">*</span></label>
            <Input id="config-name" type="text" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="config-phone" className="mb-1.5 block text-xs font-medium text-muted">
              WhatsApp <span className="text-muted">(opcional hasta solicitar contacto)</span>
            </label>
            <Input id="config-phone" type="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {saveError && <p role="alert" className="text-xs text-red-700">{saveError}</p>}
          <Button onClick={handleSave} disabled={!name.trim()} isLoading={saving} leftIcon={saved ? <Check size={14} /> : undefined}>
            {saved ? 'Guardado' : 'Guardar'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Tu cuenta</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Correo de acceso</dt>
            <dd className="break-all font-medium text-ink">{email || 'Sin correo asociado'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Miembro desde</dt>
            <dd className="font-medium text-ink">{memberSince || 'Sin registro de fecha'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Perros registrados</dt>
            <dd className="font-medium text-ink">{counts ? counts.dogs : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Direcciones guardadas</dt>
            <dd className="font-medium text-ink">{counts ? counts.addresses : '—'}</dd>
          </div>
        </dl>

        {notice && <p role="status" className="mt-4 rounded-xl bg-success/10 px-3 py-2 text-xs text-success-700">{notice}</p>}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={handlePasswordReset} isLoading={resetting} leftIcon={<KeyRound size={14} />}>
            Cambiar contraseña
          </Button>
          <Button variant="secondary" onClick={handleSignOut} leftIcon={<LogOut size={14} />}>
            Cerrar sesión
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Ir a</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {SHORTCUTS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border px-3 text-sm font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon size={15} className="text-muted" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
