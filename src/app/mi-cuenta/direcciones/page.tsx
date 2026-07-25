'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { db, auth } from '@/firebase/config'
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import {
  FaMapMarkerAlt, FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaSpinner, FaHome, FaBuilding, FaStar,
} from 'react-icons/fa'
import type { Address } from '@/types'

const ALIAS_OPTIONS = [
  { value: 'Casa', icon: FaHome },
  { value: 'Trabajo', icon: FaBuilding },
  { value: 'Otro', icon: FaMapMarkerAlt },
]

const EMPTY_FORM = {
  alias: 'Casa',
  street: '',
  exterior: '',
  interior: '',
  colony: '',
  city: '',
  state: '',
  zip: '',
  references: '',
  instructions: '',
  contactName: '',
  contactPhone: '',
  pickupInstructions: '',
  deliveryInstructions: '',
}

export default function DireccionesPage() {
  const router = useRouter()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      const q = query(collection(db, 'addresses'), where('ownerId', '==', user.uid))
      const unsub = onSnapshot(q, (snap) => {
        setAddresses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Address)))
        setLoading(false)
      }, () => setLoading(false))
      return unsub
    })
    return unsubAuth
  }, [router])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (addr: Address) => {
    setEditing(addr)
    setForm({
      alias: addr.alias || 'Casa',
      street: addr.street || '',
      exterior: addr.exterior || '',
      interior: addr.interior || '',
      colony: addr.colony || '',
      city: addr.city || '',
      state: addr.state || '',
      zip: addr.zip || '',
      references: addr.references || '',
      instructions: addr.instructions || '',
      contactName: addr.contactName || '',
      contactPhone: addr.contactPhone || '',
      pickupInstructions: addr.pickupInstructions || '',
      deliveryInstructions: addr.deliveryInstructions || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.street.trim() || !form.colony.trim()) return
    const user = auth.currentUser
    if (!user) return
    setSaving(true)
    try {
      const data = {
        ownerId: user.uid,
        alias: form.alias,
        street: form.street.trim(),
        exterior: form.exterior.trim(),
        interior: form.interior.trim(),
        colony: form.colony.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
        references: form.references.trim(),
        instructions: form.instructions.trim(),
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        pickupInstructions: form.pickupInstructions.trim(),
        deliveryInstructions: form.deliveryInstructions.trim(),
        lat: 0,
        lng: 0,
        zoneId: '',
        isDefault: addresses.length === 0,
      }
      if (editing) {
        await updateDoc(doc(db, 'addresses', editing.id), data)
      } else {
        await addDoc(collection(db, 'addresses'), { ...data, createdAt: serverTimestamp() })
      }
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY_FORM)
    } catch (err) {
      console.error('Error saving address:', err)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'addresses', id))
    setConfirmDelete(null)
  }

  const setDefault = async (id: string) => {
    const user = auth.currentUser
    if (!user) return
    // Unset all defaults
    for (const addr of addresses) {
      if (addr.isDefault && addr.id !== id) {
        await updateDoc(doc(db, 'addresses', addr.id), { isDefault: false })
      }
    }
    await updateDoc(doc(db, 'addresses', id), { isDefault: true })
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Mis Direcciones</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {addresses.length} dirección{addresses.length !== 1 ? 'es' : ''} guardada{addresses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary !text-xs flex items-center gap-1.5">
          <FaPlus size={12} /> Agregar
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-12 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <FaMapMarkerAlt className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Aún no tienes direcciones guardadas</p>
          <button onClick={openCreate} className="btn-primary !text-xs">
            Agregar primera dirección
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <motion.div
              key={addr.id}
              layout
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{addr.alias}</span>
                    {addr.isDefault && (
                      <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 font-medium flex items-center gap-1">
                        <FaStar size={8} /> Predeterminada
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {addr.street}{addr.exterior ? ` ${addr.exterior}` : ''}{addr.interior ? ` Int. ${addr.interior}` : ''}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {addr.colony}{addr.city ? `, ${addr.city}` : ''}{addr.zip ? ` CP ${addr.zip}` : ''}
                  </p>
                  {addr.references && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ref: {addr.references}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!addr.isDefault && (
                    <button onClick={() => setDefault(addr.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-brand-500/10 text-brand-400" title="Predeterminada">
                      <FaStar size={11} />
                    </button>
                  )}
                  <button onClick={() => openEdit(addr)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10 text-blue-400" title="Editar">
                    <FaEdit size={12} />
                  </button>
                  <button onClick={() => setConfirmDelete(addr.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 text-danger-400" title="Eliminar">
                    <FaTrash size={11} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Form Modal */}
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
              className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-5 space-y-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editing ? 'Editar dirección' : 'Nueva dirección'}
                </h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                  <FaTimes size={14} />
                </button>
              </div>

              {/* Alias */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
                <div className="flex gap-2">
                  {ALIAS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setForm({ ...form, alias: opt.value })}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        form.alias === opt.value
                          ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                          : 'border border-white/10 hover:border-white/20'
                      }`}
                      style={form.alias !== opt.value ? { color: 'var(--text-muted)' } : undefined}
                    >
                      <opt.icon size={12} /> {opt.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Street */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Calle *</label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  placeholder="Av. Insurgentes Sur"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Numbers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Núm. Exterior</label>
                  <input
                    type="text"
                    value={form.exterior}
                    onChange={(e) => setForm({ ...form, exterior: e.target.value })}
                    placeholder="123"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Núm. Interior</label>
                  <input
                    type="text"
                    value={form.interior}
                    onChange={(e) => setForm({ ...form, interior: e.target.value })}
                    placeholder="A"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Colony + City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Colonia *</label>
                  <input
                    type="text"
                    value={form.colony}
                    onChange={(e) => setForm({ ...form, colony: e.target.value })}
                    placeholder="Del Valle"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Ciudad</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="CDMX"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* State + Zip */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Estado</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="CDMX"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Código Postal</label>
                  <input
                    type="text"
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                    placeholder="03100"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* References */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Referencias</label>
                <textarea
                  value={form.references}
                  onChange={(e) => setForm({ ...form, references: e.target.value })}
                  rows={2}
                  placeholder="Frente al parque, casa azul..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Contact */}
              <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Contacto en la dirección</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Nombre</label>
                    <input
                      type="text"
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                      placeholder="Quién recibe"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
                    <input
                      type="tel"
                      value={form.contactPhone}
                      onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                      placeholder="5512345678"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Instrucciones</p>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Indicaciones de recolección</label>
                  <textarea
                    value={form.pickupInstructions}
                    onChange={(e) => setForm({ ...form, pickupInstructions: e.target.value })}
                    rows={2}
                    placeholder="Tocar timbre, esperar en lobby..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Indicaciones de entrega</label>
                  <textarea
                    value={form.deliveryInstructions}
                    onChange={(e) => setForm({ ...form, deliveryInstructions: e.target.value })}
                    rows={2}
                    placeholder="Dejar con portero, entregar en departamento..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.street.trim() || !form.colony.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-amber-600 text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <><FaSpinner className="animate-spin" size={12} /> Guardando...</> : <><FaCheck size={12} /> {editing ? 'Actualizar' : 'Guardar'}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl p-5 max-w-sm w-full text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <FaTrash className="text-danger-400 text-2xl mx-auto mb-3" />
              <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>¿Eliminar esta dirección?</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl text-sm border hover:bg-white/5" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  Cancelar
                </button>
                <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-danger-500 text-white hover:opacity-90">
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
