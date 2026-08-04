'use client'

import { useState, useEffect } from 'react'
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPinned, Plus, Pencil, Trash2, X, Check, Loader2,
  Eye, EyeOff, Search,
} from 'lucide-react'
import { Zone } from '@/types'

interface ZoneForm {
  name: string
  centerLat: string
  centerLng: string
  radius: string
  basePrice: string
  fixedAdjustment: string
  percentAdjustment: string
  transitIncluded: boolean
  coverageRadius: string
  minOrder: string
}

const EMPTY_FORM: ZoneForm = {
  name: '', centerLat: '', centerLng: '', radius: '3',
  basePrice: '0', fixedAdjustment: '0', percentAdjustment: '0',
  transitIncluded: true, coverageRadius: '5', minOrder: '0',
}

export default function AdminZonasPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Zone | null>(null)
  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'zones'))
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Zone))
      setZones(docs)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = zones.filter((z) => z.name.toLowerCase().includes(search.toLowerCase()))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (zone: Zone) => {
    setEditing(zone)
    setForm({
      name: zone.name,
      centerLat: String(zone.center?.lat || ''),
      centerLng: String(zone.center?.lng || ''),
      radius: String(zone.radius || '3'),
      basePrice: String(zone.basePrice || '0'),
      fixedAdjustment: String(zone.fixedAdjustment || '0'),
      percentAdjustment: String(zone.percentAdjustment || '0'),
      transitIncluded: zone.transitIncluded ?? true,
      coverageRadius: String(zone.coverageRadius || '5'),
      minOrder: String(zone.minOrder || '0'),
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        center: {
          lat: parseFloat(form.centerLat) || 0,
          lng: parseFloat(form.centerLng) || 0,
        },
        radius: parseFloat(form.radius) || 3,
        active: true,
        walkerIds: editing?.walkerIds || [],
        basePrice: parseFloat(form.basePrice) || 0,
        fixedAdjustment: parseFloat(form.fixedAdjustment) || 0,
        percentAdjustment: parseFloat(form.percentAdjustment) || 0,
        transitIncluded: form.transitIncluded,
        coverageRadius: parseFloat(form.coverageRadius) || 5,
        minOrder: parseFloat(form.minOrder) || 0,
        availableHours: editing?.availableHours || {},
        stats: editing?.stats || { totalClients: 0, totalWalks: 0, avgDemand: 0 },
      }

      if (editing) {
        await updateDoc(doc(db, 'zones', editing.id), data)
      } else {
        await addDoc(collection(db, 'zones'), { ...data, createdAt: serverTimestamp() })
      }
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY_FORM)
    } catch (err) {
      console.error('Error saving zone:', err)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'zones', id))
    setConfirmDelete(null)
  }

  const toggleActive = async (zone: Zone) => {
    await updateDoc(doc(db, 'zones', zone.id), { active: !zone.active })
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-10 w-48 rounded-xl" />
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Zonas</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {zones.length} zona{zones.length !== 1 ? 's' : ''} · {zones.filter((z) => z.active).length} activa{zones.filter((z) => z.active).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary !text-xs inline-flex gap-2">
          <Plus size={12} /> Agregar zona
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar zona..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <MapPinned className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {search ? 'Sin resultados' : 'No hay zonas configuradas'}
          </p>
          {!search && (
            <button onClick={openCreate} className="btn-primary !text-xs mt-4 inline-flex gap-2">
              <Plus size={12} /> Crear primera zona
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((zone, i) => (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl p-4 transition-all hover:bg-white/[0.02]"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: zone.active ? 1 : 0.6 }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${zone.active ? 'bg-success-500/10' : 'bg-white/5'}`}>
                    <MapPinned size={14} className={zone.active ? 'text-success-400' : 'text-white/30'} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{zone.name}</p>
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                      {zone.active ? 'Activa' : 'Inactiva'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleActive(zone)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title={zone.active ? 'Desactivar' : 'Activar'}>
                    {zone.active ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button onClick={() => openEdit(zone)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => setConfirmDelete(zone.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 hover:text-danger-400" style={{ color: 'var(--text-muted)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg py-2" style={{ background: 'var(--glass-bg)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{zone.stats?.totalClients || 0}</p>
                  <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Clientes</p>
                </div>
                <div className="rounded-lg py-2" style={{ background: 'var(--glass-bg)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{zone.stats?.totalWalks || 0}</p>
                  <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Paseos</p>
                </div>
                <div className="rounded-lg py-2" style={{ background: 'var(--glass-bg)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{zone.walkerIds?.length || 0}</p>
                  <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Paseadores</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-2xl p-5 space-y-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editing ? `Editar ${editing.name}` : 'Nueva zona'}
                </h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                  <X size={14} />
                </button>
              </div>

              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Centro, Polanco, Roma Norte..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Latitud</label>
                  <input
                    type="number"
                    step="any"
                    value={form.centerLat}
                    onChange={(e) => setForm({ ...form, centerLat: e.target.value })}
                    placeholder="19.4326"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Longitud</label>
                  <input
                    type="number"
                    step="any"
                    value={form.centerLng}
                    onChange={(e) => setForm({ ...form, centerLng: e.target.value })}
                    placeholder="-99.1332"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Radio (km)</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.radius}
                  onChange={(e) => setForm({ ...form, radius: e.target.value })}
                  placeholder="3"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Precios por zona</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Ajuste fijo ($)</label>
                    <input
                      type="number"
                      step="1"
                      value={form.fixedAdjustment}
                      onChange={(e) => setForm({ ...form, fixedAdjustment: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Ajuste %</label>
                    <input
                      type="number"
                      step="1"
                      value={form.percentAdjustment}
                      onChange={(e) => setForm({ ...form, percentAdjustment: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Cobertura mínima ($)</label>
                    <input
                      type="number"
                      step="1"
                      value={form.minOrder}
                      onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={form.transitIncluded}
                      onChange={(e) => setForm({ ...form, transitIncluded: e.target.checked })}
                      className="rounded"
                      id="transitIncluded"
                    />
                    <label htmlFor="transitIncluded" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Traslado incluido</label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-40">
                  {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                  {editing ? 'Guardar' : 'Crear zona'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="rounded-2xl p-6 w-full max-w-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Eliminar zona</h3>
              <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={() => confirmDelete && handleDelete(confirmDelete)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-danger-500 hover:bg-danger-600 transition-colors">Eliminar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
