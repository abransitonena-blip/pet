'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { getCustomerProfile, updateCustomerProfile } from '@/lib/customerProfile'
import { auth } from '@/firebase/config'
import { Settings, Loader2, Check } from 'lucide-react'
import Link from 'next/link'

export default function ConfigPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }
      const profile = await getCustomerProfile(user.uid)
      if (profile) {
        setName(profile.name || '')
        setPhone(profile.phone || '')
      }
      setLoading(false)
    })
    return unsub
  }, [router])

  const handleSave = async () => {
    const user = auth.currentUser
    if (!user) return
    setSaving(true)
    try {
      await updateCustomerProfile(user.uid, { name, phone })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <Settings className="text-3xl mx-auto mb-2 animate-pulse" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Configuración</h2>
      <div className="space-y-4 max-w-sm">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Nombre <span aria-hidden="true">*</span></label>
          <input
            type="text"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>WhatsApp <span className="text-muted">(opcional hasta solicitar contacto)</span></label>
          <input
            type="tel"
            maxLength={20}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="btn-primary inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="animate-spin" size={14} /> : saved ? <Check size={14} /> : null}
          {saved ? 'Guardado' : 'Guardar'}
        </button>
        <p className="text-xs text-muted">Estos datos se usan para cuenta y contacto operativo. No implican marketing ni publicación de fotografías. Gestiona solicitudes en <Link href="/familia/privacidad" className="underline">Privacidad y ARCO</Link>.</p>
      </div>
    </div>
  )
}
