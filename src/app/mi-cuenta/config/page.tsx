'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { FaCog, FaSpinner, FaCheck } from 'react-icons/fa'

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
      const snap = await getDoc(doc(db, 'clients', user.uid))
      if (snap.exists()) {
        const data = snap.data()
        setName(data.name || '')
        setPhone(data.phone || '')
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
      await updateDoc(doc(db, 'clients', user.uid), { name, phone })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <FaCog className="text-3xl mx-auto mb-2 animate-pulse" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Configuración</h2>
      <div className="space-y-4 max-w-sm">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>WhatsApp</label>
          <input
            type="tel"
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
          {saving ? <FaSpinner className="animate-spin" size={14} /> : saved ? <FaCheck size={14} /> : null}
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
