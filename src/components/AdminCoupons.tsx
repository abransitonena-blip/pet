'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Tag, Plus, Trash2, Loader2, Percent, DollarSign, ToggleLeft, ToggleRight, Pencil, Check, X } from 'lucide-react'
import { useToast } from '@/context/ToastContext'

interface Coupon {
  id: string
  code: string
  discount: number
  type: 'percentage' | 'fixed'
  active: boolean
  maxUses: number
  usedCount: number
  createdAt: Timestamp
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [code, setCode] = useState('')
  const [discount, setDiscount] = useState('')
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage')
  const [maxUses, setMaxUses] = useState('0')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editDiscount, setEditDiscount] = useState('')
  const [editType, setEditType] = useState<'percentage' | 'fixed'>('percentage')
  const [editMaxUses, setEditMaxUses] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Coupon)))
    })
    return unsub
  }, [])

  const handleCreate = async () => {
    if (!code.trim() || !discount) return
    setCreating(true)
    try {
      await addDoc(collection(db, 'coupons'), {
        code: code.trim().toUpperCase(),
        discount: Number(discount),
        type,
        active: true,
        maxUses: Number(maxUses) || 0,
        usedCount: 0,
        createdAt: Timestamp.now(),
      })
      setCode('')
      setDiscount('')
      setType('percentage')
      setMaxUses('0')
      toast('Cupón creado')
    } catch { toast('Error al crear cupón', 'error') }
    setCreating(false)
  }

  const toggleActive = async (c: Coupon) => {
    try {
      await updateDoc(doc(db, 'coupons', c.id), { active: !c.active })
      toast('Cupón actualizado')
    } catch { toast('Error al actualizar cupón', 'error') }
  }

  const startEdit = (c: Coupon) => {
    setEditingId(c.id)
    setEditCode(c.code)
    setEditDiscount(String(c.discount))
    setEditType(c.type)
    setEditMaxUses(String(c.maxUses))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditCode('')
    setEditDiscount('')
    setEditType('percentage')
    setEditMaxUses('')
  }

  const saveEdit = async (id: string) => {
    if (!editCode.trim() || !editDiscount) return
    try {
      await updateDoc(doc(db, 'coupons', id), {
        code: editCode.trim().toUpperCase(),
        discount: Number(editDiscount),
        type: editType,
        maxUses: Number(editMaxUses) || 0,
      })
      cancelEdit()
      toast('Cupón actualizado')
    } catch { toast('Error al actualizar cupón', 'error') }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Tag className="text-primary" size={14} />
        <h4 className="text-sm font-semibold text-ink">Cupones de descuento</h4>
      </div>

      <div className="glass p-4 rounded-xl mb-6 space-y-3">
        <div className="grid sm:grid-cols-4 gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Código del cupón" placeholder="Código (ej: BIENVENIDO)"
            className="bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary placeholder:text-muted"
          />
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            aria-label="Monto del descuento" placeholder="Descuento"
            className="bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary placeholder:text-muted"
          />
          <input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            aria-label="Usos máximos" placeholder="Usos máx (0 = ilimitado)"
            className="bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary placeholder:text-muted"
          />
          <select aria-label="Tipo de descuento"
            value={type}
            onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}
            className="bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary"
          >
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed">Monto fijo ($)</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || !code.trim() || !discount}
          className="flex items-center gap-2 text-xs px-4 py-2 rounded-full bg-primary/20 text-primary-hover hover:bg-primary/30 transition-all disabled:opacity-30"
        >
          {creating ? <Loader2 className="animate-spin" size={10} /> : <Plus size={10} />}
          Crear cupón
        </button>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center py-10 text-muted">
          <Tag className="text-3xl mx-auto mb-2" />
          <p className="text-xs">Crea tu primer cupón de descuento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-3 rounded-xl"
            >
              {editingId === c.id ? (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-4 gap-3">
                    <input
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      aria-label="Código del cupón" placeholder="Código"
                      className="bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(e.target.value)}
                      aria-label="Monto del descuento" placeholder="Descuento"
                      className="bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      value={editMaxUses}
                      onChange={(e) => setEditMaxUses(e.target.value)}
                      aria-label="Usos máximos" placeholder="Usos máx (0 = ilimitado)"
                      className="bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary"
                    />
                    <select aria-label="Tipo de descuento"
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as 'percentage' | 'fixed')}
                      className="bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="percentage">Porcentaje (%)</option>
                      <option value="fixed">Monto fijo ($)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveEdit(c.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-500/15 text-green-800 hover:bg-green-500/25 transition-all"
                    >
                      <Check size={10} /> Guardar
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-ink/5 text-muted hover:bg-ink/10 transition-all"
                    >
                      <X size={10} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.active ? 'bg-green-500/15' : 'bg-ink/5'}`}>
                      {c.type === 'percentage' ? <Percent size={12} style={c.active ? { color: 'var(--color-success)' } : { color: 'var(--text-muted)' }} /> : <DollarSign size={12} style={c.active ? { color: 'var(--color-success)' } : { color: 'var(--text-muted)' }} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{c.code}</span>
                        <span className="text-xs font-bold text-primary">
                          {c.type === 'percentage' ? `${c.discount}%` : `$${c.discount}`}
                        </span>
                      </div>
                      <p className="text-2xs text-muted">
                        Usado {c.usedCount} veces {c.maxUses > 0 ? `/ ${c.maxUses}` : '• sin límite'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(c)}
                      className="transition-all" style={c.active ? { color: 'var(--color-success)' } : { color: 'var(--text-muted)' }}
                    >
                      {c.active ? <ToggleLeft size={18} /> : <ToggleRight size={18} />}
                    </button>
                    <button
                      onClick={() => startEdit(c)}
                      className="w-7 h-7 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center transition-all" style={{ color: 'var(--color-accent)' }}
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={async () => { try { await deleteDoc(doc(db, 'coupons', c.id)); toast('Cupón eliminado') } catch { toast('Error al eliminar cupón', 'error') } }}
                      className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-all" style={{ color: 'var(--color-danger)' }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
