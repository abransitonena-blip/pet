'use client'

import { useState, useEffect } from 'react'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FaBullhorn, FaSpinner } from 'react-icons/fa'

export default function AdminBanner() {
  const [message, setMessage] = useState('')
  const [active, setActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'admin', 'banner')).then((snap) => {
      if (snap.exists()) {
        setMessage(snap.data().message || '')
        setActive(snap.data().active || false)
      }
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    await setDoc(doc(db, 'admin', 'banner'), { message, active })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="glass p-4 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <FaBullhorn className="text-primary" size={14} />
        <h4 className="text-sm font-semibold text-white">Banner de promociones</h4>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ej: 🎉 20% de descuento en tu primer paseo"
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20 resize-none mb-2"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
          <input type="checkbox" checked={active} onChange={() => setActive(!active)} className="accent-primary" />
          Mostrar banner
        </label>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-all disabled:opacity-30"
        >
          {saving ? <FaSpinner className="animate-spin" size={10} /> : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
