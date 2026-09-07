'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion } from 'framer-motion'
import { UserPlus, Plus, Trash2, Copy, Check } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import { Button, Card, EmptyState, Input } from '@/components/ui'
import { brand } from '@/lib/brand'
import { useToast } from '@/context/ToastContext'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { confirmWhatsAppShare } from '@/lib/utils'

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
  const { toast } = useToast()

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
    if (!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED) {
      toast('La automatización de referidos está desactivada. Registra cualquier revisión mediante el proceso manual seguro.', 'error')
      return
    }
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
      toast('Referido creado')
    } catch { toast('Error al crear referido', 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED) {
      toast('Las mutaciones automáticas de referidos están desactivadas.', 'error')
      return
    }
    try {
      await deleteDoc(doc(db, 'referrals', id))
      toast('Referido eliminado')
    } catch { toast('Error al eliminar referido', 'error') }
  }

  const handleStatus = async (id: string, status: Referral['status']) => {
    if (!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED) {
      toast('Las recompensas automáticas están desactivadas y requieren revisión manual.', 'error')
      return
    }
    try {
      await import('firebase/firestore').then(({ updateDoc, doc: d }) =>
        updateDoc(d(db, 'referrals', id), { status })
      )
      toast('Estado actualizado')
    } catch { toast('Error al actualizar estado', 'error') }
  }

  const copyLink = (phone: string) => {
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${phone.replace(/\D/g, '')}`
    navigator.clipboard.writeText(link)
    setCopied(phone)
    setTimeout(() => setCopied(''), 2000)
  }

  const shareWhatsApp = (_name: string, phone: string) => {
    const link = `${window.location.origin}?ref=${phone.replace(/\D/g, '')}`
    const msg = `🐾 Te recomiendo ${brand.name} para solicitar paseos caninos programados. Conoce el servicio aquí: ${link}`
    confirmWhatsAppShare('', msg)
  }

  const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-brand-500/15 text-brand-600',
    completed: 'bg-success-500/15 text-success-600',
    rewarded: 'bg-brand-500/15 text-brand-600',
  }

  return (
    <div>
      <PageHeader
        title="Referidos"
        description="Programa de referidos y recompensas"
        actions={
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} leftIcon={<Plus size={10} />}>
            Nuevo referido
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'brand' },
          { label: 'Completados', value: stats.completed, color: 'success' },
          { label: 'Pendientes', value: stats.pending, color: 'brand' },
          { label: 'Recompensas', value: `$${stats.totalRewards}`, color: 'accent' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Conversion rate */}
      <div className="rounded-xl border border-ink/10 bg-surface p-4 mb-6 shadow-sm">
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
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-xl border border-ink/10 bg-surface p-4 mb-6 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Nombre referente</label>
              <Input value={newRef.referrerName} onChange={(e) => setNewRef({ ...newRef, referrerName: e.target.value })} className="text-sm" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Teléfono referente</label>
              <Input value={newRef.referrerPhone} onChange={(e) => setNewRef({ ...newRef, referrerPhone: e.target.value })} className="text-sm" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Nombre referido</label>
              <Input value={newRef.refereeName} onChange={(e) => setNewRef({ ...newRef, refereeName: e.target.value })} className="text-sm" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Teléfono referido</label>
              <Input value={newRef.refereePhone} onChange={(e) => setNewRef({ ...newRef, refereePhone: e.target.value })} className="text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED} isLoading={saving} leftIcon={<Plus size={10} />} title={FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED ? undefined : 'La automatización de referidos está desactivada'}>
              Guardar
            </Button>
          </div>
        </motion.div>
      )}

      {/* Referrals list */}
      {loading ? (
        <LoadingState rows={3} height="h-16" />
      ) : referrals.length === 0 ? (
        <Card className="p-8">
          <EmptyState icon={<UserPlus size={28} />} title="Sin referidos aún" />
        </Card>
      ) : (
        <div className="space-y-2">
          {referrals.map((r) => (
            <div key={r.id} className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.referrerName}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
                  <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{r.refereeName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] || 'bg-ink/10 text-[var(--text-muted)]'}`}>
                    {r.status === 'pending' ? 'Pendiente' : r.status === 'completed' ? 'Completado' : 'Recompensado'}
                  </span>
                  <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>${r.rewardAmount} MXN</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {r.status === 'pending' && (
                  <button onClick={() => handleStatus(r.id, 'completed')} disabled={!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-success-500/10 text-success-400 disabled:cursor-not-allowed disabled:opacity-40" title={FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED ? 'Marcar completado' : 'Las recompensas automáticas están desactivadas'}>
                    <Check size={10} />
                  </button>
                )}
                <button onClick={() => copyLink(r.referrerPhone)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-ink/5" style={{ color: 'var(--text-muted)' }} title="Copiar link">
                  {copied === r.referrerPhone ? <Check size={10} className="text-success-400" /> : <Copy size={10} />}
                </button>
                <button onClick={() => shareWhatsApp(r.referrerName, r.referrerPhone)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-green-500/10 text-green-400" title="Compartir WhatsApp">
                  <WhatsAppIcon width={10} height={10} />
                </button>
                <button onClick={() => handleDelete(r.id)} disabled={!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-danger-500/10 text-danger-400 disabled:cursor-not-allowed disabled:opacity-40" title={FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED ? 'Eliminar' : 'Las mutaciones automáticas de referidos están desactivadas'}>
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { WhatsAppIcon } from '@/components/ui/SocialIcons'
