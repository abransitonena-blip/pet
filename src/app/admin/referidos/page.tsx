'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FaUserFriends, FaPlus, FaTrash, FaWhatsapp, FaCopy, FaCheck, FaSpinner } from 'react-icons/fa'
import { brand } from '@/lib/brand'

interface Referral {
  id: string
  referrerName: string
  referrerPhone: string
  refereeName: string
  refereePhone: string
  status: 'pending' | 'completed' | 'rewarded'
  rewardAmount: number
  createdAt: { seconds: number; nanoseconds: number }
}

export default function AdminReferidosPage() {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newRef, setNewRef] = useState({ referrerName: '', referrerPhone: '', refereeName: '', refereePhone: '' })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'referrals'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setReferrals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Referral)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const stats = useMemo(() => {
    const total = referrals.length
    const completed = referrals.filter((r) => r.status === 'completed' || r.status === 'rewarded').length
    const pending = referrals.filter((r) => r.status === 'pending').length
    const rewarded = referrals.filter((r) => r.status === 'rewarded').length
    const totalRewards = referrals.reduce((sum, r) => sum + (r.status === 'rewarded' ? r.rewardAmount : 0), 0)
    const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, pending, rewarded, totalRewards, conversionRate }
  }, [referrals])

  const handleAdd = async () => {
    if (!newRef.referrerName.trim() || !newRef.referrerPhone.trim() || !newRef.refereeName.trim()) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'referrals', Date.now().toString()), {
        ...newRef,
        status: 'pending',
        rewardAmount: 20,
        createdAt: serverTimestamp(),
      })
      setNewRef({ referrerName: '', referrerPhone: '', refereeName: '', refereePhone: '' })
      setShowAdd(false)
    } catch {}
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'referrals', id))
  }

  const handleStatus = async (id: string, status: Referral['status']) => {
    await import('firebase/firestore').then(({ updateDoc, doc: d }) =>
      updateDoc(d(db, 'referrals', id), { status })
    )
  }

  const copyLink = (phone: string) => {
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${phone.replace(/\D/g, '')}`
    navigator.clipboard.writeText(link)
    setCopied(phone)
    setTimeout(() => setCopied(''), 2000)
  }

  const shareWhatsApp = (name: string, phone: string) => {
    const link = `${window.location.origin}?ref=${phone.replace(/\D/g, '')}`
    const msg = `🐾 ¡Te recomiendo ${brand.name}! Paseos caninos supervisados. Agenda aquí: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-brand-500/15 text-brand-400',
    completed: 'bg-success-500/15 text-success-400',
    rewarded: 'bg-accent-500/15 text-accent-400',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Referidos</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Programa de referidos y recompensas</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs flex items-center gap-2">
          <FaPlus size={10} /> Nuevo referido
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'brand' },
          { label: 'Completados', value: stats.completed, color: 'success' },
          { label: 'Pendientes', value: stats.pending, color: 'brand' },
          { label: 'Recompensas', value: `$${stats.totalRewards}`, color: 'accent' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Conversion rate */}
      <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tasa de conversión</span>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{stats.conversionRate}%</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: 'var(--glass-bg)' }}>
          <div className="h-full rounded-full bg-gradient-to-r from-success-500 to-success-400 transition-all" style={{ width: `${stats.conversionRate}%` }} />
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-xl p-4 mb-6 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Nombre referente</label>
              <input value={newRef.referrerName} onChange={(e) => setNewRef({ ...newRef, referrerName: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Teléfono referente</label>
              <input value={newRef.referrerPhone} onChange={(e) => setNewRef({ ...newRef, referrerPhone: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Nombre referido</label>
              <input value={newRef.refereeName} onChange={(e) => setNewRef({ ...newRef, refereeName: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Teléfono referido</label>
              <input value={newRef.refereePhone} onChange={(e) => setNewRef({ ...newRef, refereePhone: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleAdd} disabled={saving} className="btn-primary text-xs flex items-center gap-2">
              {saving ? <FaSpinner className="animate-spin" size={10} /> : <FaPlus size={10} />}
              Guardar
            </button>
          </div>
        </motion.div>
      )}

      {/* Referrals list */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : referrals.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <FaUserFriends className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin referidos aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {referrals.map((r) => (
            <div key={r.id} className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.referrerName}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
                  <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{r.refereeName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] || 'bg-white/10 text-slate-400'}`}>
                    {r.status === 'pending' ? 'Pendiente' : r.status === 'completed' ? 'Completado' : 'Recompensado'}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>${r.rewardAmount} MXN</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {r.status === 'pending' && (
                  <button onClick={() => handleStatus(r.id, 'completed')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-success-500/10 text-success-400" title="Marcar completado">
                    <FaCheck size={10} />
                  </button>
                )}
                <button onClick={() => copyLink(r.referrerPhone)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title="Copiar link">
                  {copied === r.referrerPhone ? <FaCheck size={10} className="text-success-400" /> : <FaCopy size={10} />}
                </button>
                <button onClick={() => shareWhatsApp(r.referrerName, r.referrerPhone)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-green-500/10 text-green-400" title="Compartir WhatsApp">
                  <FaWhatsapp size={10} />
                </button>
                <button onClick={() => handleDelete(r.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-danger-500/10 text-danger-400" title="Eliminar">
                  <FaTrash size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
