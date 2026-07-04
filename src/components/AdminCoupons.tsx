'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FaTag, FaPlus, FaTrash, FaSpinner, FaPercent, FaDollarSign, FaToggleOn, FaToggleOff } from 'react-icons/fa'

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
    setCreating(false)
  }

  const toggleActive = async (c: Coupon) => {
    await updateDoc(doc(db, 'coupons', c.id), { active: !c.active })
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <FaTag className="text-primary" size={14} />
        <h4 className="text-sm font-semibold text-white">Cupones de descuento</h4>
      </div>

      <div className="glass p-4 rounded-xl mb-6 space-y-3">
        <div className="grid sm:grid-cols-4 gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código (ej: BIENVENIDO)"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
          />
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="Descuento"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
          />
          <input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Usos máx (0 = ilimitado)"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
          >
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed">Monto fijo ($)</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || !code.trim() || !discount}
          className="flex items-center gap-2 text-xs px-4 py-2 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-all disabled:opacity-30"
        >
          {creating ? <FaSpinner className="animate-spin" size={10} /> : <FaPlus size={10} />}
          Crear cupón
        </button>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center py-10 text-white/20">
          <FaTag className="text-3xl mx-auto mb-2" />
          <p className="text-xs">Crea tu primer cupón de descuento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-3 rounded-xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.active ? 'bg-green-500/20' : 'bg-white/5'}`}>
                  {c.type === 'percentage' ? <FaPercent className={c.active ? 'text-green-400' : 'text-white/30'} size={12} /> : <FaDollarSign className={c.active ? 'text-green-400' : 'text-white/30'} size={12} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{c.code}</span>
                    <span className="text-xs font-bold text-primary">
                      {c.type === 'percentage' ? `${c.discount}%` : `$${c.discount}`}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/30">
                    Usado {c.usedCount} veces {c.maxUses > 0 ? `/ ${c.maxUses}` : '• sin límite'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(c)}
                  className={`transition-all ${c.active ? 'text-green-400' : 'text-white/30'}`}
                >
                  {c.active ? <FaToggleOn size={18} /> : <FaToggleOff size={18} />}
                </button>
                <button
                  onClick={() => deleteDoc(doc(db, 'coupons', c.id))}
                  className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all"
                >
                  <FaTrash size={10} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
